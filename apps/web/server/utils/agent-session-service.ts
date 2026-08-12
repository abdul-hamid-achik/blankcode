import type { AgentScript } from '@blankcode/shared/types'
import {
  type AgentAction,
  type AgentEvent,
  type AgentSessionState,
  applyDecision,
  applyShowBeat,
  canDecide,
  canRevealTests,
  canShowNextBeat,
  isTerminal,
  type Refusal,
  scoreSupervision,
  type SupervisionReport,
} from './agent-session'

/**
 * The supervision flow, with storage and the sandbox passed in.
 *
 * Same reason as turn-session-service: the interesting failures are a turn
 * charged twice, a sitting resumed after close, tests handed over early —
 * all testable against a memory store. The runner is a function so close
 * can grade without this file importing a database.
 */

export interface StoredAgentSession extends AgentSessionState {
  readonly id: string
  readonly userId: string
  readonly exerciseId: string
  readonly script: AgentScript
  readonly currentCode: string | null
  readonly lastEvidence: AgentEvidence | null
  readonly workPassed: boolean | null
  readonly finalCode: string | null
}

export interface AgentEvidence {
  readonly passed: boolean
  readonly testResults?: Array<{
    name: string
    passed: boolean
    message: string | null
  }>
  readonly errorMessage?: string | null
}

export interface AgentSessionStore {
  load(id: string): Promise<StoredAgentSession | null>
  create(input: {
    userId: string
    exerciseId: string
    script: AgentScript
    maxAgentTurns: number
    maxInterventions: number
    currentCode: string | null
  }): Promise<StoredAgentSession>
  save(id: string, patch: Partial<StoredAgentSession>): Promise<StoredAgentSession>
}

export type Result<T> =
  | { ok: true; value: T }
  | Refusal
  | { ok: false; reason: 'not-found'; status: number }

export type RunBeat = (code: string, exerciseId: string) => Promise<AgentEvidence>

async function own(
  store: AgentSessionStore,
  id: string,
  userId: string
): Promise<StoredAgentSession | null> {
  const session = await store.load(id)
  if (!session || session.userId !== userId) return null
  return session
}

function currentBeat(session: StoredAgentSession) {
  const beat = session.script.beats[session.beatIndex]
  if (!beat) return null
  return { say: beat.say, run: beat.run, hasCode: beat.code !== null }
}

export interface PublicLedgerEntry {
  readonly kind: 'agent' | 'you'
  readonly say?: string
  readonly run?: boolean
  readonly action?: string
  readonly beatIndex: number
}

export interface PublicAgentSession {
  readonly id: string
  readonly exerciseId: string
  readonly status: AgentSessionState['status']
  readonly beatIndex: number
  readonly beat: { say: string; run: boolean; hasCode: boolean } | null
  readonly currentCode: string | null
  readonly ledger: readonly PublicLedgerEntry[]
  readonly evidence: AgentEvidence | null
  readonly agentTurnsUsed: number
  readonly maxAgentTurns: number
  readonly interventionsUsed: number
  readonly maxInterventions: number
  readonly report: SupervisionReport | null
}

function ledgerOf(session: StoredAgentSession): PublicLedgerEntry[] {
  const lastAgent =
    session.status === 'open' ? session.beatIndex : Math.max(0, session.script.beats.length - 1)
  const entries: PublicLedgerEntry[] = []
  for (let i = 0; i <= lastAgent; i++) {
    const beat = session.script.beats[i]
    if (!beat) continue
    entries.push({ kind: 'agent', say: beat.say, run: beat.run, beatIndex: i })
    const decision = session.events.find(
      (event) => event.type === 'decision' && event.beatIndex === i
    )
    if (decision && decision.type === 'decision') {
      entries.push({ kind: 'you', action: decision.action, beatIndex: i })
    }
  }
  return entries
}

export function publicView(
  session: StoredAgentSession,
  report: SupervisionReport | null = null
): PublicAgentSession {
  return {
    id: session.id,
    exerciseId: session.exerciseId,
    status: session.status,
    beatIndex: session.beatIndex,
    beat: session.status === 'open' ? currentBeat(session) : null,
    currentCode: session.currentCode,
    ledger: ledgerOf(session),
    evidence: session.lastEvidence,
    agentTurnsUsed: session.agentTurnsUsed,
    maxAgentTurns: session.maxAgentTurns,
    interventionsUsed: session.interventionsUsed,
    maxInterventions: session.maxInterventions,
    report:
      report ??
      (session.status !== 'open' && session.workPassed !== null
        ? scoreSupervision(session.script, session.events, session.workPassed)
        : null),
  }
}

export async function startAgentSession(
  store: AgentSessionStore,
  userId: string,
  exerciseId: string,
  script: AgentScript,
  maxAgentTurns: number,
  maxInterventions: number,
  starterCode: string,
  runBeat?: RunBeat
): Promise<PublicAgentSession> {
  const firstWithCode = script.beats.find((beat) => beat.code !== null)
  const session = await store.create({
    userId,
    exerciseId,
    script,
    maxAgentTurns,
    maxInterventions,
    currentCode: firstWithCode?.code ?? starterCode,
  })
  const opening = script.beats[0]
  if (runBeat && opening?.run && session.currentCode) {
    const evidence = await runBeat(session.currentCode, exerciseId)
    const saved = await store.save(session.id, { lastEvidence: evidence })
    return publicView(saved)
  }
  return publicView(session)
}

export async function takeDecision(
  store: AgentSessionStore,
  id: string,
  userId: string,
  action: AgentAction,
  note: string | undefined,
  runBeat: RunBeat
): Promise<Result<PublicAgentSession>> {
  const session = await own(store, id, userId)
  if (!session) return { ok: false, reason: 'not-found', status: 404 }

  const allowed = canDecide(session, action, note)
  if (!allowed.ok) return allowed

  if (isTerminal(action)) {
    return { ok: false, reason: 'session-closed', status: 409 }
  }

  let evidence = session.lastEvidence
  if (action === 'demand-evidence' && session.currentCode) {
    evidence = await runBeat(session.currentCode, session.exerciseId)
  }

  let next: StoredAgentSession = {
    ...applyDecision(session, action),
    id: session.id,
    userId: session.userId,
    exerciseId: session.exerciseId,
    script: session.script,
    currentCode: session.currentCode,
    lastEvidence: evidence,
    workPassed: session.workPassed,
    finalCode: session.finalCode,
  }

  const upcoming = next.script.beats[next.beatIndex]
  if (upcoming) {
    const show = canShowNextBeat(next)
    if (show.ok) {
      next = { ...next, ...applyShowBeat(next) }
    }
    if (upcoming.code) next = { ...next, currentCode: upcoming.code }
    const codeToRun = upcoming.code ?? next.currentCode
    if (upcoming.run && codeToRun) {
      evidence = await runBeat(codeToRun, session.exerciseId)
      next = { ...next, lastEvidence: evidence }
    }
  }

  const saved = await store.save(id, {
    status: next.status,
    beatIndex: next.beatIndex,
    agentTurnsUsed: next.agentTurnsUsed,
    interventionsUsed: next.interventionsUsed,
    events: next.events,
    currentCode: next.currentCode,
    lastEvidence: next.lastEvidence,
  })

  return { ok: true, value: publicView(saved) }
}

export async function closeAgentSession(
  store: AgentSessionStore,
  id: string,
  userId: string,
  action: 'accept-work' | 'reject-work',
  runTests: RunBeat
): Promise<Result<PublicAgentSession>> {
  const session = await own(store, id, userId)
  if (!session) return { ok: false, reason: 'not-found', status: 404 }

  const allowed = canDecide(session, action)
  if (!allowed.ok) return allowed

  const code = session.currentCode ?? ''
  const run = code.length > 0 ? await runTests(code, session.exerciseId) : { passed: false }
  const workPassed = run.passed

  const decided = applyDecision(session, action)
  const events = decided.events as readonly AgentEvent[]
  const report = scoreSupervision(session.script, events, workPassed)

  const saved = await store.save(id, {
    status: 'submitted',
    events,
    finalCode: code,
    lastEvidence: run,
    workPassed,
    revealedAt: new Date(),
  })

  return { ok: true, value: publicView(saved, report) }
}

export async function revealAgentTests(
  store: AgentSessionStore,
  id: string,
  userId: string,
  loadTests: (exerciseId: string) => Promise<string>
): Promise<Result<string>> {
  const session = await own(store, id, userId)
  if (!session) return { ok: false, reason: 'not-found', status: 404 }

  const decision = canRevealTests(session)
  if (!decision.ok) return decision

  return { ok: true, value: await loadTests(session.exerciseId) }
}

export async function loadOwnSession(
  store: AgentSessionStore,
  id: string,
  userId: string
): Promise<Result<PublicAgentSession>> {
  const session = await own(store, id, userId)
  if (!session) return { ok: false, reason: 'not-found', status: 404 }
  return { ok: true, value: publicView(session) }
}
