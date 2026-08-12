import type { AgentScript, AgentSeedKind } from '@blankcode/shared/types'

/**
 * What the suite must do to a code state for the authored seed to be true.
 *
 * `run` means the sandbox produced a verdict (pass or fail) — the code is
 * executable. `fail` / `pass` are the seed's claimed divergence.
 */
export type CodeExpect = 'pass' | 'fail' | 'run'

export interface AgentCodeState {
  readonly label: string
  readonly code: string
  readonly expect: CodeExpect
}

const MUST_FAIL = new Set<AgentSeedKind>(['hallucinated-pass', 'wrong-diagnosis', 'budget-burner'])

/** The code sitting on the agent's desk at this beat — own patch or inherited. */
export function codeInForce(
  script: AgentScript,
  beatIndex: number,
  starter: string
): string | null {
  for (let i = beatIndex; i >= 0; i--) {
    const code = script.beats[i]?.code
    if (code && code.trim().length > 0) return code
  }
  return starter.trim().length > 0 ? starter : null
}

/**
 * Every authored code state, with the strongest expectation the seeds impose.
 *
 * The same text appearing as a fix and as a hallucinated-pass is a broken
 * exercise — that is the class of lie this exists to catch — so a pass/fail
 * collision is an error, not a later sandbox surprise.
 */
export function collectAgentCodeStates(
  script: AgentScript,
  starter: string
): { ok: true; states: AgentCodeState[] } | { ok: false; reason: string } {
  const byCode = new Map<string, AgentCodeState>()

  const add = (label: string, code: string | null | undefined, expect: CodeExpect) => {
    if (!code || code.trim().length === 0) return
    const existing = byCode.get(code)
    if (!existing) {
      byCode.set(code, { label, code, expect })
      return
    }
    if (existing.expect === expect || expect === 'run') return
    if (existing.expect === 'run') {
      byCode.set(code, { ...existing, expect, label })
      return
    }
    throw new Error(
      `${label} must ${expect} but ${existing.label} already requires ${existing.expect}`
    )
  }

  try {
    script.beats.forEach((beat, i) => add(`beat ${i}`, beat.code, 'run'))
    for (const seed of script.seeds) {
      seed.caught.forEach((beat, i) =>
        add(`seed ${seed.kind}@${seed.at} caught[${i}]`, beat.code, 'run')
      )
      seed.missed.forEach((beat, i) =>
        add(`seed ${seed.kind}@${seed.at} missed[${i}]`, beat.code, 'run')
      )
      if (MUST_FAIL.has(seed.kind)) {
        add(`seed ${seed.kind}@${seed.at} in-force`, codeInForce(script, seed.at, starter), 'fail')
      }
    }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }

  return { ok: true, states: [...byCode.values()] }
}

/**
 * A seed that says "this code is a lie" cannot share text with the
 * reference solution — that would be a hallucinated-pass whose code is green.
 */
export function solutionConflicts(
  states: readonly AgentCodeState[],
  solution: string
): string | null {
  const clash = states.find((state) => state.code === solution && state.expect === 'fail')
  if (!clash) return null
  return `${clash.label} must fail the suite, but it is the reference solution`
}

export function expectationHolds(
  expect: CodeExpect,
  result: { status: string; testResults?: ReadonlyArray<unknown> | null }
): boolean {
  const ran = (result.testResults?.length ?? 0) > 0
  if (expect === 'pass') return result.status === 'passed' && ran
  if (expect === 'fail') return result.status !== 'passed'
  return result.status === 'passed' || result.status === 'failed' || result.status === 'error'
}
