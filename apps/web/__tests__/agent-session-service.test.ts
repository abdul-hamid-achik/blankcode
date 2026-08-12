import type { AgentScript } from '@blankcode/shared/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  type AgentSessionStore,
  closeAgentSession,
  loadOwnSession,
  revealAgentTests,
  startAgentSession,
  type StoredAgentSession,
  takeDecision,
} from '~/server/utils/agent-session-service'

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
      caught: [],
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

function memoryStore(): AgentSessionStore & { rows: Map<string, StoredAgentSession> } {
  const rows = new Map<string, StoredAgentSession>()
  let next = 1
  return {
    rows,
    async load(id) {
      return rows.get(id) ?? null
    },
    async create({ userId, exerciseId, script, maxAgentTurns, maxInterventions, currentCode }) {
      const session: StoredAgentSession = {
        id: `a${next++}`,
        userId,
        exerciseId,
        script,
        status: 'open',
        beatIndex: 0,
        maxAgentTurns,
        agentTurnsUsed: 1,
        maxInterventions,
        interventionsUsed: 0,
        events: [],
        revealedAt: null,
        currentCode,
        lastEvidence: null,
        workPassed: null,
        finalCode: null,
      }
      rows.set(session.id, session)
      return session
    },
    async save(id, patch) {
      const current = rows.get(id)
      if (!current) throw new Error(`no session ${id}`)
      const updated = { ...current, ...patch }
      rows.set(id, updated)
      return updated
    },
  }
}

const passes = async () => ({ passed: true })
const fails = async () => ({ passed: false })

let store: ReturnType<typeof memoryStore>

beforeEach(() => {
  store = memoryStore()
})

describe('startAgentSession', () => {
  it('opens on beat zero and does not leak the script', async () => {
    const view = await startAgentSession(store, 'u1', 'e1', SCRIPT, 2, 3, 'starter()')
    expect(view.beatIndex).toBe(0)
    expect(view.beat?.say).toContain('tighten the mock')
    expect(view.agentTurnsUsed).toBe(1)
    expect(JSON.stringify(view)).not.toContain('forEach discarded')
    expect(JSON.stringify(view)).not.toContain('hallucinated-pass')
    expect(view.ledger[0]).toMatchObject({ kind: 'agent', beatIndex: 0 })
    expect(view.currentCode).toBe('broken()')
    expect(view.evidence).toBeNull()
  })

  it('runs the opening beat when the script says the agent ran', async () => {
    const runBeat = vi.fn(fails)
    const view = await startAgentSession(store, 'u1', 'e1', SCRIPT, 2, 3, 'starter()', runBeat)
    expect(runBeat).toHaveBeenCalledWith('broken()', 'e1')
    expect(view.evidence).toEqual({ passed: false })
  })
})

describe('takeDecision', () => {
  it('records a reject and advances to the next beat', async () => {
    const started = await startAgentSession(store, 'u1', 'e1', SCRIPT, 2, 3, 'starter()')
    const result = await takeDecision(store, started.id, 'u1', 'reject', undefined, fails)

    expect(result.ok).toBe(true)
    expect(result.ok && result.value.beatIndex).toBe(1)
    expect(result.ok && result.value.beat?.say).toContain('All tests pass')
    expect(result.ok && result.value.interventionsUsed).toBe(1)
    expect(store.rows.get(started.id)?.events).toEqual([
      { type: 'decision', action: 'reject', beatIndex: 0 },
    ])
  })

  it('does not charge approve', async () => {
    const started = await startAgentSession(store, 'u1', 'e1', SCRIPT, 2, 3, 'starter()')
    const result = await takeDecision(store, started.id, 'u1', 'approve', undefined, fails)
    expect(result.ok && result.value.interventionsUsed).toBe(0)
  })

  it('runs the current code when evidence is demanded', async () => {
    const runBeat = vi.fn(fails)
    const started = await startAgentSession(store, 'u1', 'e1', SCRIPT, 2, 3, 'starter()')
    const result = await takeDecision(
      store,
      started.id,
      'u1',
      'demand-evidence',
      undefined,
      runBeat
    )

    expect(runBeat).toHaveBeenCalled()
    expect(result.ok && result.value.evidence).toEqual({ passed: false })
  })

  it('runs the current code when the next beat asks for a run without a new patch', async () => {
    const script: AgentScript = {
      ...SCRIPT,
      beats: [
        { say: 'I will tighten the mock.', code: 'broken()', run: true },
        { say: 'Running it now.', code: null, run: true },
      ],
    }
    const runBeat = vi.fn(fails)
    const started = await startAgentSession(store, 'u1', 'e1', script, 2, 3, 'starter()')
    const result = await takeDecision(store, started.id, 'u1', 'approve', undefined, runBeat)
    expect(runBeat).toHaveBeenCalledWith('broken()', 'e1')
    expect(result.ok && result.value.evidence).toEqual({ passed: false })
  })

  it('refuses once interventions are spent', async () => {
    const started = await startAgentSession(store, 'u1', 'e1', SCRIPT, 2, 1, 'starter()')
    await takeDecision(store, started.id, 'u1', 'reject', undefined, fails)
    const again = await takeDecision(store, started.id, 'u1', 'reject', undefined, fails)
    expect(!again.ok && again.status).toBe(429)
  })

  it("does not let one user decide another's sitting", async () => {
    const started = await startAgentSession(store, 'u1', 'e1', SCRIPT, 2, 3, 'starter()')
    const result = await takeDecision(store, started.id, 'u2', 'reject', undefined, fails)
    expect(!result.ok && result.status).toBe(404)
    expect(store.rows.get(started.id)?.interventionsUsed).toBe(0)
  })

  it('refuses a terminal action on the decide path', async () => {
    const started = await startAgentSession(store, 'u1', 'e1', SCRIPT, 2, 3, 'starter()')
    const result = await takeDecision(store, started.id, 'u1', 'accept-work', undefined, fails)
    expect(!result.ok && result.status).toBe(409)
  })
})

describe('closeAgentSession', () => {
  it('scores a clean catch-and-accept against passing work', async () => {
    const started = await startAgentSession(store, 'u1', 'e1', SCRIPT, 2, 3, 'starter()')
    await takeDecision(store, started.id, 'u1', 'reject', undefined, fails)
    await takeDecision(store, started.id, 'u1', 'demand-evidence', undefined, fails)

    const closed = await closeAgentSession(store, started.id, 'u1', 'accept-work', passes)
    expect(closed.ok).toBe(true)
    expect(closed.ok && closed.value.report?.passed).toBe(true)
    expect(closed.ok && closed.value.beat).toBeNull()
    expect(store.rows.get(started.id)?.revealedAt).toBeInstanceOf(Date)
    expect(store.rows.get(started.id)?.status).toBe('submitted')
    expect(store.rows.get(started.id)?.workPassed).toBe(true)
    const resumed = await loadOwnSession(store, started.id, 'u1')
    expect(resumed.ok && resumed.value.report?.passed).toBe(true)
  })

  it('fails when the supervisor accepts work that does not pass', async () => {
    const started = await startAgentSession(store, 'u1', 'e1', SCRIPT, 2, 3, 'starter()')
    await takeDecision(store, started.id, 'u1', 'approve', undefined, fails)
    await takeDecision(store, started.id, 'u1', 'approve', undefined, fails)

    const closed = await closeAgentSession(store, started.id, 'u1', 'accept-work', fails)
    expect(closed.ok && closed.value.report?.passed).toBe(false)
    expect(closed.ok && closed.value.report?.finalCallCorrect).toBe(false)
  })

  it('cannot be done twice', async () => {
    const started = await startAgentSession(store, 'u1', 'e1', SCRIPT, 2, 3, 'starter()')
    await closeAgentSession(store, started.id, 'u1', 'reject-work', fails)
    const again = await closeAgentSession(store, started.id, 'u1', 'accept-work', passes)
    expect(!again.ok && again.status).toBe(409)
  })

  it('refuses for a different user', async () => {
    const started = await startAgentSession(store, 'u1', 'e1', SCRIPT, 2, 3, 'starter()')
    const result = await closeAgentSession(store, started.id, 'u2', 'accept-work', passes)
    expect(!result.ok && result.status).toBe(404)
  })
})

describe('revealAgentTests', () => {
  const loadTests = async () => 'the hidden suite'

  it('refuses while the sitting is open', async () => {
    const started = await startAgentSession(store, 'u1', 'e1', SCRIPT, 2, 3, 'starter()')
    const result = await revealAgentTests(store, started.id, 'u1', loadTests)
    expect(!result.ok && result.status).toBe(403)
  })

  it('releases them once closed', async () => {
    const started = await startAgentSession(store, 'u1', 'e1', SCRIPT, 2, 3, 'starter()')
    await closeAgentSession(store, started.id, 'u1', 'reject-work', fails)
    const result = await revealAgentTests(store, started.id, 'u1', loadTests)
    expect(result.ok && result.value).toBe('the hidden suite')
  })
})

describe('loadOwnSession', () => {
  it('returns the public view for the owner', async () => {
    const started = await startAgentSession(store, 'u1', 'e1', SCRIPT, 2, 3, 'starter()')
    const loaded = await loadOwnSession(store, started.id, 'u1')
    expect(loaded.ok && loaded.value.id).toBe(started.id)
  })

  it("hides someone else's sitting as missing", async () => {
    const started = await startAgentSession(store, 'u1', 'e1', SCRIPT, 2, 3, 'starter()')
    const loaded = await loadOwnSession(store, started.id, 'u2')
    expect(!loaded.ok && loaded.status).toBe(404)
  })
})
