import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseExercise } from '@blankcode/exercise-parser'
import type { AgentScript } from '@blankcode/shared/types'
import { describe, expect, it } from 'vitest'
import {
  codeInForce,
  collectAgentCodeStates,
  expectationHolds,
  solutionConflicts,
} from '../services/content-verify/agent-states.js'

const SCRIPT: AgentScript = {
  beats: [
    { say: 'I will tighten the mock.', code: 'broken()', run: true },
    { say: 'All tests pass now.', code: null, run: false },
  ],
  seeds: [
    {
      at: 0,
      kind: 'wrong-diagnosis',
      window: 1,
      weight: 2,
      truth: 'forEach discarded the promises',
      caught: [{ say: 'Switching to for…of.', code: 'fixed()', run: true }],
      missed: [],
    },
    {
      at: 1,
      kind: 'hallucinated-pass',
      window: 1,
      weight: 3,
      truth: 'no run backs the claim',
      caught: [],
      missed: [],
    },
  ],
  rubric: [{ id: 'final-call', weight: 3 }],
}

describe('codeInForce', () => {
  it('inherits the last authored patch when a beat has no new code', () => {
    expect(codeInForce(SCRIPT, 1, 'starter()')).toBe('broken()')
  })

  it('falls back to the starter when nothing has been patched yet', () => {
    const empty = { ...SCRIPT, beats: [{ say: 'looking', code: null, run: false }] }
    expect(codeInForce(empty, 0, 'starter()')).toBe('starter()')
  })
})

describe('collectAgentCodeStates', () => {
  it('requires the in-force code of a defect seed to fail', () => {
    const collected = collectAgentCodeStates(SCRIPT, 'starter()')
    expect(collected.ok).toBe(true)
    if (!collected.ok) return
    const broken = collected.states.find((state) => state.code === 'broken()')
    expect(broken?.expect).toBe('fail')
    expect(collected.states.some((state) => state.code === 'fixed()')).toBe(true)
  })

  it('flags a hallucinated-pass whose in-force code is the reference solution', () => {
    const lie: AgentScript = {
      beats: [{ say: 'ship it', code: 'fixed()', run: false }],
      seeds: [
        {
          at: 0,
          kind: 'hallucinated-pass',
          window: 1,
          weight: 3,
          truth: 'no run',
          caught: [],
          missed: [],
        },
      ],
      rubric: [],
    }
    const collected = collectAgentCodeStates(lie, 'starter()')
    expect(collected.ok).toBe(true)
    if (!collected.ok) return
    expect(solutionConflicts(collected.states, 'fixed()')).toMatch(/reference solution/)
    expect(solutionConflicts(collected.states, 'other()')).toBeNull()
  })
})

describe('expectationHolds', () => {
  it('treats a green suite as a broken hallucinated-pass', () => {
    expect(expectationHolds('fail', { status: 'passed', testResults: [{}] })).toBe(false)
    expect(expectationHolds('fail', { status: 'failed', testResults: [{}] })).toBe(true)
  })

  it('does not accept a pass with zero tests', () => {
    expect(expectationHolds('pass', { status: 'passed', testResults: [] })).toBe(false)
    expect(expectationHolds('pass', { status: 'passed', testResults: [{}] })).toBe(true)
  })
})

describe('ts-agent-001', () => {
  it('the authored script defect states are the forEach code, the fix is for-of', () => {
    const markdown = readFileSync(
      join(process.cwd(), '../../content/tracks/typescript/supervision/ts-agent-001.md'),
      'utf-8'
    )
    const parsed = parseExercise(markdown)
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    const script = parsed.exercise.agentScript
    expect(script).not.toBeNull()
    if (!script) return

    const collected = collectAgentCodeStates(script, parsed.exercise.starterCode)
    expect(collected.ok).toBe(true)
    if (!collected.ok) return

    const mustFail = collected.states.filter((state) => state.expect === 'fail')
    expect(mustFail.length).toBeGreaterThan(0)
    for (const state of mustFail) {
      expect(state.code).toContain('forEach')
      expect(state.code).not.toContain('for (const item of items)')
    }
    expect(collected.states.some((state) => state.code.includes('for (const item of items)'))).toBe(
      true
    )
  })
})

describe('content:verify wires the collector', () => {
  it('the verify script asks the collector about agent scripts', () => {
    const source = readFileSync(join(process.cwd(), 'scripts/verify-solutions.ts'), 'utf-8')
    expect(source).toContain('collectAgentCodeStates')
    expect(source).toContain("type === 'agent'")
  })
})
