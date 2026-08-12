import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  revealTests,
  type SessionStore,
  startSession,
  type StoredSession,
  submitSession,
  takeTurn,
} from '~/server/utils/turn-session-service'

/**
 * An in-memory store with the same contract as the drizzle one.
 *
 * The point of the service taking a store is that this whole flow — turns,
 * ownership, closing, revealing — is exercisable without a database and without
 * a gateway key. The only thing these tests cannot cover is whether the model
 * says something useful.
 */
function memoryStore(): SessionStore & { rows: Map<string, StoredSession> } {
  const rows = new Map<string, StoredSession>()
  let next = 1
  return {
    rows,
    async load(id) {
      return rows.get(id) ?? null
    },
    async create({ userId, exerciseId, maxTurns }) {
      const session: StoredSession = {
        id: `s${next++}`,
        userId,
        exerciseId,
        maxTurns,
        turnsUsed: 0,
        messages: [],
        finalCode: null,
        status: 'open',
        revealedAt: null,
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

const echo = async () => 'here is some code'
const passes = async () => true
const fails = async () => false

let store: ReturnType<typeof memoryStore>

beforeEach(() => {
  store = memoryStore()
})

describe('takeTurn', () => {
  it('spends a turn and records both sides of the exchange', async () => {
    const session = await startSession(store, 'u1', 'e1', 3)
    const result = await takeTurn(store, echo, session.id, 'u1', 'write a parser')

    expect(result.ok).toBe(true)
    expect(result.ok && result.value.turnsUsed).toBe(1)
    expect(result.ok && result.value.turnsRemaining).toBe(2)
    expect(store.rows.get(session.id)?.messages).toEqual([
      { role: 'user', content: 'write a parser' },
      { role: 'assistant', content: 'here is some code' },
    ])
  })

  it('refuses once the budget is gone, and does not call the model', async () => {
    const session = await startSession(store, 'u1', 'e1', 2)
    const generate = vi.fn(echo)

    await takeTurn(store, generate, session.id, 'u1', 'one')
    await takeTurn(store, generate, session.id, 'u1', 'two')
    const third = await takeTurn(store, generate, session.id, 'u1', 'three')

    expect(third.ok).toBe(false)
    expect(!third.ok && third.status).toBe(429)
    // The check has to happen before the call or the budget costs money to
    // enforce, which is the opposite of what it is for.
    expect(generate).toHaveBeenCalledTimes(2)
  })

  it('keeps the turn spent when generation fails', async () => {
    const session = await startSession(store, 'u1', 'e1', 3)
    const boom = async () => {
      throw new Error('gateway down')
    }

    await expect(takeTurn(store, boom, session.id, 'u1', 'hello')).rejects.toThrow('gateway down')
    // The request was made and paid for. Refunding it would turn a flaky
    // gateway into free turns.
    expect(store.rows.get(session.id)?.turnsUsed).toBe(1)
  })

  it("does not let one user spend another user's budget", async () => {
    const session = await startSession(store, 'u1', 'e1', 3)
    const result = await takeTurn(store, echo, session.id, 'u2', 'hi')

    expect(result.ok).toBe(false)
    // 404 rather than 403: telling a caller the id exists is telling them whose
    // transcript to go looking for.
    expect(!result.ok && result.status).toBe(404)
    expect(store.rows.get(session.id)?.turnsUsed).toBe(0)
  })

  it('refuses an unknown session', async () => {
    const result = await takeTurn(store, echo, 'nope', 'u1', 'hi')
    expect(!result.ok && result.status).toBe(404)
  })

  it('refuses after the session was submitted', async () => {
    const session = await startSession(store, 'u1', 'e1', 3)
    await submitSession(store, session.id, 'u1', 'code', passes)

    const result = await takeTurn(store, echo, session.id, 'u1', 'one more')
    expect(!result.ok && result.status).toBe(409)
  })
})

describe('submitSession', () => {
  it('closes the session and reports what was spared', async () => {
    const session = await startSession(store, 'u1', 'e1', 3)
    await takeTurn(store, echo, session.id, 'u1', 'one')

    const result = await submitSession(store, session.id, 'u1', 'final code', passes)

    expect(result.ok).toBe(true)
    expect(result.ok && result.value.outcome).toEqual({
      passed: true,
      turnsUsed: 1,
      maxTurns: 3,
      turnsSpared: 2,
    })
    expect(store.rows.get(session.id)?.finalCode).toBe('final code')
  })

  it('is allowed with the budget exhausted', async () => {
    const session = await startSession(store, 'u1', 'e1', 1)
    await takeTurn(store, echo, session.id, 'u1', 'only turn')

    const result = await submitSession(store, session.id, 'u1', 'code', fails)
    expect(result.ok).toBe(true)
    expect(result.ok && result.value.outcome.passed).toBe(false)
  })

  it('cannot be done twice', async () => {
    const session = await startSession(store, 'u1', 'e1', 3)
    await submitSession(store, session.id, 'u1', 'code', passes)

    const again = await submitSession(store, session.id, 'u1', 'other code', passes)
    expect(!again.ok && again.status).toBe(409)
  })

  it('closes and stamps in one write', async () => {
    const session = await startSession(store, 'u1', 'e1', 3)
    await submitSession(store, session.id, 'u1', 'code', passes)

    const row = store.rows.get(session.id)
    // Two writes would leave a window where the session is closed but unstamped,
    // and the reveal rule reads both — a crash there locks the learner out of
    // their own results.
    expect(row?.status).toBe('submitted')
    expect(row?.revealedAt).toBeInstanceOf(Date)
  })

  it('refuses for a different user', async () => {
    const session = await startSession(store, 'u1', 'e1', 3)
    const result = await submitSession(store, session.id, 'u2', 'code', passes)
    expect(!result.ok && result.status).toBe(404)
  })
})

describe('revealTests', () => {
  const loadTests = async () => 'the hidden suite'

  it('refuses while the session is open', async () => {
    const session = await startSession(store, 'u1', 'e1', 3)
    const result = await revealTests(store, session.id, 'u1', loadTests)

    expect(result.ok).toBe(false)
    expect(!result.ok && result.status).toBe(403)
  })

  it('still refuses when the budget is spent but the session is open', async () => {
    const session = await startSession(store, 'u1', 'e1', 1)
    await takeTurn(store, echo, session.id, 'u1', 'only turn')

    // This is the one that matters: out of turns is exactly when someone would
    // try, and the tests are still the answer key.
    const result = await revealTests(store, session.id, 'u1', loadTests)
    expect(!result.ok && result.status).toBe(403)
  })

  it('releases them once the session is submitted', async () => {
    const session = await startSession(store, 'u1', 'e1', 3)
    await submitSession(store, session.id, 'u1', 'code', passes)

    const result = await revealTests(store, session.id, 'u1', loadTests)
    expect(result.ok && result.value).toBe('the hidden suite')
  })

  it('does not release them to another user', async () => {
    const session = await startSession(store, 'u1', 'e1', 3)
    await submitSession(store, session.id, 'u1', 'code', passes)

    const result = await revealTests(store, session.id, 'u2', loadTests)
    expect(!result.ok && result.status).toBe(404)
  })
})
