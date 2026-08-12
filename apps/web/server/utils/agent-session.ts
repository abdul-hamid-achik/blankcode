/**
 * The rules of an agent-supervision session.
 *
 * Deliberately free of the database and of the model: everything here is a
 * pure decision about what a supervisor may do next, and how the log is
 * scored against the authored seeds. A budget that can be got around is not
 * a constraint; a rubric that needs a judge model is not verifiable.
 *
 * Mirrors `turn-session.ts` — same Decision/Refusal shape, same reason that
 * the rules live outside the route.
 */

import type { AgentScript, AgentSeed, AgentSeedKind } from '@blankcode/shared/types'

export type SessionStatus = 'open' | 'submitted' | 'abandoned'

export type AgentAction =
  | 'approve'
  | 'reject'
  | 'interrupt'
  | 'demand-evidence'
  | 'redirect'
  | 'accept-work'
  | 'reject-work'

/** Interventions that cost a slot of the human's budget. Approve is free. */
export const COSTING_ACTIONS: ReadonlySet<AgentAction> = new Set([
  'reject',
  'interrupt',
  'demand-evidence',
  'redirect',
])

/**
 * The intervention that counts as catching each seed kind.
 *
 * Hallucinated pass: demand the run, or reject the claim.
 * Invention: reject before budget is spent implementing it.
 * Budget-burner: stop the loop or redirect it.
 * Wrong diagnosis: disagree.
 */
export const CATCH_ACTIONS: {
  readonly [K in AgentSeedKind]: readonly AgentAction[]
} = {
  'hallucinated-pass': ['demand-evidence', 'reject'],
  'confident-invention': ['reject'],
  'budget-burner': ['interrupt', 'redirect'],
  'wrong-diagnosis': ['reject'],
}

export interface AgentDecisionEvent {
  readonly type: 'decision'
  readonly action: AgentAction
  readonly beatIndex: number
}

export interface AgentFinalEvent {
  readonly type: 'final'
  readonly action: 'accept-work' | 'reject-work'
}

export type AgentEvent = AgentDecisionEvent | AgentFinalEvent

export interface AgentSessionState {
  readonly status: SessionStatus
  /** Beat currently on screen. */
  readonly beatIndex: number
  readonly maxAgentTurns: number
  readonly agentTurnsUsed: number
  readonly maxInterventions: number
  readonly interventionsUsed: number
  readonly events: readonly AgentEvent[]
  readonly revealedAt: Date | null
}

export type Refusal =
  | { readonly ok: false; readonly reason: 'session-closed'; readonly status: number }
  | { readonly ok: false; readonly reason: 'no-interventions-left'; readonly status: number }
  | { readonly ok: false; readonly reason: 'no-agent-turns-left'; readonly status: number }
  | { readonly ok: false; readonly reason: 'empty-note'; readonly status: number }
  | { readonly ok: false; readonly reason: 'not-revealed'; readonly status: number }
  | { readonly ok: false; readonly reason: 'already-decided'; readonly status: number }

export type Decision<T> = { readonly ok: true; readonly value: T } | Refusal

export function interventionsRemaining(session: AgentSessionState): number {
  return Math.max(0, session.maxInterventions - session.interventionsUsed)
}

export function agentTurnsRemaining(session: AgentSessionState): number {
  return Math.max(0, session.maxAgentTurns - session.agentTurnsUsed)
}

export function isCosting(action: AgentAction): boolean {
  return COSTING_ACTIONS.has(action)
}

export function isTerminal(action: AgentAction): boolean {
  return action === 'accept-work' || action === 'reject-work'
}

export function catchesSeed(kind: AgentSeedKind, action: AgentAction): boolean {
  return CATCH_ACTIONS[kind].includes(action)
}

/**
 * Whether the supervisor may take this action on the current beat.
 *
 * Costing actions are checked on the way in, same reason as turn-session:
 * counting after the fact makes the last intervention free.
 */
export function canDecide(
  session: AgentSessionState,
  action: AgentAction,
  note?: string
): Decision<{ interventionsAfter: number }> {
  if (session.status !== 'open') {
    return { ok: false, reason: 'session-closed', status: 409 }
  }

  if (session.events.some((event) => event.type === 'final')) {
    return { ok: false, reason: 'already-decided', status: 409 }
  }

  if (action === 'redirect' && (note === undefined || note.trim().length === 0)) {
    // A redirect without an instruction is not a redirect, it is a skip
    // wearing a verb. Refuse rather than charge for nothing.
    return { ok: false, reason: 'empty-note', status: 400 }
  }

  if (isTerminal(action)) {
    return { ok: true, value: { interventionsAfter: session.interventionsUsed } }
  }

  if (isCosting(action) && interventionsRemaining(session) <= 0) {
    return { ok: false, reason: 'no-interventions-left', status: 429 }
  }

  return {
    ok: true,
    value: {
      interventionsAfter: isCosting(action)
        ? session.interventionsUsed + 1
        : session.interventionsUsed,
    },
  }
}

/**
 * Whether the agent may present another authored beat.
 *
 * Separate from the human budget: the script has a length, and showing a
 * beat the budget does not cover would make agentBudget decoration.
 */
export function canShowNextBeat(session: AgentSessionState): Decision<{ agentTurnsAfter: number }> {
  if (session.status !== 'open') {
    return { ok: false, reason: 'session-closed', status: 409 }
  }
  if (agentTurnsRemaining(session) <= 0) {
    return { ok: false, reason: 'no-agent-turns-left', status: 429 }
  }
  return { ok: true, value: { agentTurnsAfter: session.agentTurnsUsed + 1 } }
}

export function canRevealTests(session: AgentSessionState): Decision<true> {
  if (session.status === 'open' || session.revealedAt === null) {
    return { ok: false, reason: 'not-revealed', status: 403 }
  }
  return { ok: true, value: true }
}

/**
 * Apply a legal decision. Callers must have already received ok from
 * `canDecide`; this function does not re-check, so a test can see the
 * state transition in isolation.
 */
export function applyDecision(session: AgentSessionState, action: AgentAction): AgentSessionState {
  if (action === 'accept-work' || action === 'reject-work') {
    const event: AgentFinalEvent = { type: 'final', action }
    return {
      ...session,
      status: 'submitted',
      events: [...session.events, event],
    }
  }

  const event: AgentDecisionEvent = {
    type: 'decision',
    action,
    beatIndex: session.beatIndex,
  }

  return {
    ...session,
    beatIndex: session.beatIndex + 1,
    interventionsUsed: isCosting(action)
      ? session.interventionsUsed + 1
      : session.interventionsUsed,
    events: [...session.events, event],
  }
}

export function applyShowBeat(session: AgentSessionState): AgentSessionState {
  return {
    ...session,
    agentTurnsUsed: session.agentTurnsUsed + 1,
  }
}

/** Inclusive window of decision points in which a seed can still be caught. */
export function seedWindow(seed: AgentSeed): { start: number; end: number } {
  return { start: seed.at, end: seed.at + seed.window - 1 }
}

export function beatInSeedWindow(seed: AgentSeed, beatIndex: number): boolean {
  const { start, end } = seedWindow(seed)
  return beatIndex >= start && beatIndex <= end
}

export type CatchVerdict = 'caught' | 'late' | 'missed'

export function seedVerdict(seed: AgentSeed, events: readonly AgentEvent[]): CatchVerdict {
  const { start, end } = seedWindow(seed)
  const decisions = events.filter((event): event is AgentDecisionEvent => event.type === 'decision')

  const inWindow = decisions.filter((event) => event.beatIndex >= start && event.beatIndex <= end)
  if (inWindow.some((event) => catchesSeed(seed.kind, event.action))) return 'caught'

  const after = decisions.filter((event) => event.beatIndex > end)
  if (after.some((event) => catchesSeed(seed.kind, event.action))) return 'late'

  return 'missed'
}

function isHealthyBeat(script: AgentScript, beatIndex: number): boolean {
  return !script.seeds.some((seed) => beatInSeedWindow(seed, beatIndex))
}

/** Interventions spent on beats that carried no live seed. */
export function falseAlarmCount(script: AgentScript, events: readonly AgentEvent[]): number {
  return events.filter(
    (event): event is AgentDecisionEvent =>
      event.type === 'decision' && isCosting(event.action) && isHealthyBeat(script, event.beatIndex)
  ).length
}

export const FALSE_ALARM_WEIGHT = 2
export const DEFAULT_FINAL_CALL_WEIGHT = 3
export const PASS_RATIO = 0.7

export interface SeedScore {
  readonly at: number
  readonly kind: AgentSeedKind
  readonly truth: string
  readonly verdict: CatchVerdict
  readonly weight: number
  readonly awarded: number
}

export interface SupervisionReport {
  readonly seeds: readonly SeedScore[]
  readonly falseAlarms: number
  readonly falseAlarmAwarded: number
  readonly falseAlarmWeight: number
  readonly finalCall: 'accept-work' | 'reject-work' | null
  readonly finalCallCorrect: boolean
  readonly finalCallAwarded: number
  readonly finalCallWeight: number
  readonly score: number
  readonly maxScore: number
  readonly passed: boolean
}

function finalCallWeightOf(script: AgentScript): number {
  const point = script.rubric.find((row) => row.id === 'final-call')
  return point?.weight ?? DEFAULT_FINAL_CALL_WEIGHT
}

function awardedForCatch(verdict: CatchVerdict, weight: number): number {
  if (verdict === 'caught') return weight
  if (verdict === 'late') return Math.floor(weight / 2)
  return 0
}

function awardedForFinalCall(
  action: 'accept-work' | 'reject-work' | null,
  workPassed: boolean,
  weight: number
): { awarded: number; correct: boolean } {
  if (action === null) return { awarded: 0, correct: false }
  const correct =
    (action === 'accept-work' && workPassed) || (action === 'reject-work' && !workPassed)
  if (action === 'accept-work' && !workPassed) return { awarded: 0, correct: false }
  if (action === 'reject-work' && workPassed) return { awarded: 1, correct: false }
  return { awarded: correct ? weight : 0, correct }
}

/**
 * Score a finished sitting against the authored script.
 *
 * `workPassed` is the true verdict of the final code (a real sandbox run),
 * not the agent's claim. The human was the check; the schedule will believe
 * this pass.
 */
export function scoreSupervision(
  script: AgentScript,
  events: readonly AgentEvent[],
  workPassed: boolean
): SupervisionReport {
  const seeds = script.seeds.map((seed) => {
    const verdict = seedVerdict(seed, events)
    return {
      at: seed.at,
      kind: seed.kind,
      truth: seed.truth,
      verdict,
      weight: seed.weight,
      awarded: awardedForCatch(verdict, seed.weight),
    }
  })

  const falseAlarms = falseAlarmCount(script, events)
  const falseAlarmAwarded = Math.max(0, FALSE_ALARM_WEIGHT - falseAlarms)

  const final = events.find((event): event is AgentFinalEvent => event.type === 'final')
  const finalAction = final?.action ?? null
  const finalWeight = finalCallWeightOf(script)
  const finalCall = awardedForFinalCall(finalAction, workPassed, finalWeight)

  const score =
    seeds.reduce((sum, seed) => sum + seed.awarded, 0) + falseAlarmAwarded + finalCall.awarded
  const maxScore =
    seeds.reduce((sum, seed) => sum + seed.weight, 0) + FALSE_ALARM_WEIGHT + finalWeight

  return {
    seeds,
    falseAlarms,
    falseAlarmAwarded,
    falseAlarmWeight: FALSE_ALARM_WEIGHT,
    finalCall: finalAction,
    finalCallCorrect: finalCall.correct,
    finalCallAwarded: finalCall.awarded,
    finalCallWeight: finalWeight,
    score,
    maxScore,
    passed: maxScore > 0 && score / maxScore >= PASS_RATIO && finalCall.correct,
  }
}

export interface AgentOutcome {
  readonly passed: boolean
  readonly score: number
  readonly maxScore: number
  readonly interventionsUsed: number
  readonly maxInterventions: number
}

export function summarise(session: AgentSessionState, report: SupervisionReport): AgentOutcome {
  return {
    passed: report.passed,
    score: report.score,
    maxScore: report.maxScore,
    interventionsUsed: session.interventionsUsed,
    maxInterventions: session.maxInterventions,
  }
}
