import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  type ContextSessionStore,
  selectSource,
  startContextSession,
  type StoredContextSession,
  submitAnswer,
} from '../server/utils/context-session-service'

const SOURCES = [
  { id: 'schema', label: 'Table definitions', tokens: 400 },
  { id: 'docs', label: 'The whole ORM manual', tokens: 6000 },
]

function memoryStore(): ContextSessionStore & { rows: Map<string, StoredContextSession> } {
  const rows = new Map<string, StoredContextSession>()
  let next = 1
  return {
    rows,
    async load(id) {
      return rows.get(id) ?? null
    },
    async create({ userId, exerciseId, sources, required }) {
      const session: StoredContextSession = {
        id: `c${next++}`,
        userId,
        exerciseId,
        sources,
        required,
        selected: [],
        answer: null,
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

const content = async (_exerciseId: string, sourceId: string) => `contents of ${sourceId}`
const correct = async () => true
const wrong = async () => false

let store: ReturnType<typeof memoryStore>

const start = () => startContextSession(store, 'u1', 'e1', SOURCES, ['schema'])

beforeEach(() => {
  store = memoryStore()
})

describe('selectSource', () => {
  it('hands over the content and records the charge', async () => {
    const session = await start()
    const result = await selectSource(store, session.id, 'u1', 'schema', content)

    expect(result.ok && result.value.content).toBe('contents of schema')
    expect(result.ok && result.value.tokensSpent).toBe(400)
    expect(store.rows.get(session.id)?.selected).toEqual(['schema'])
  })

  it('charges once for the same source asked twice', async () => {
    const session = await start()
    await selectSource(store, session.id, 'u1', 'schema', content)
    const again = await selectSource(store, session.id, 'u1', 'schema', content)

    // The cost is of having been shown it. Charging per request would make a
    // retry after a dropped connection cost points for nothing.
    expect(again.ok && again.value.alreadyHeld).toBe(true)
    expect(again.ok && again.value.tokensSpent).toBe(400)
    expect(store.rows.get(session.id)?.selected).toEqual(['schema'])
  })

  it('accumulates the cost across sources', async () => {
    const session = await start()
    await selectSource(store, session.id, 'u1', 'schema', content)
    const second = await selectSource(store, session.id, 'u1', 'docs', content)

    expect(second.ok && second.value.tokensSpent).toBe(6400)
  })

  it('refuses a source this exercise does not have, without charging', async () => {
    const session = await start()
    const loader = vi.fn(content)
    const result = await selectSource(store, session.id, 'u1', 'logs', loader)

    expect(!result.ok && result.status).toBe(404)
    expect(loader).not.toHaveBeenCalled()
    expect(store.rows.get(session.id)?.selected).toEqual([])
  })

  it('does not hand content to another user', async () => {
    const session = await start()
    const loader = vi.fn(content)
    const result = await selectSource(store, session.id, 'u2', 'schema', loader)

    expect(!result.ok && result.status).toBe(404)
    expect(loader).not.toHaveBeenCalled()
  })

  it('refuses after the answer was submitted', async () => {
    const session = await start()
    await submitAnswer(store, session.id, 'u1', 'select 1', correct)

    const result = await selectSource(store, session.id, 'u1', 'docs', content)
    expect(!result.ok && result.status).toBe(409)
  })
})

describe('submitAnswer', () => {
  it('scores against the selection the server recorded', async () => {
    const session = await start()
    await selectSource(store, session.id, 'u1', 'schema', content)

    const result = await submitAnswer(store, session.id, 'u1', 'select 1', correct)

    expect(result.ok && result.value).toEqual({
      correct: true,
      sufficient: true,
      tokensSpent: 400,
      minimalTokens: 400,
      tokensWasted: 0,
      unnecessary: [],
      unknown: [],
    })
  })

  it('reports waste when more was taken than needed', async () => {
    const session = await start()
    await selectSource(store, session.id, 'u1', 'schema', content)
    await selectSource(store, session.id, 'u1', 'docs', content)

    const result = await submitAnswer(store, session.id, 'u1', 'select 1', correct)
    expect(result.ok && result.value.tokensWasted).toBe(6000)
    expect(result.ok && result.value.unnecessary).toEqual(['docs'])
  })

  it('marks an answer given without the required source as insufficient', async () => {
    const session = await start()
    const result = await submitAnswer(store, session.id, 'u1', 'select 1', correct)

    // Right answer, nothing handed over: they knew it or guessed, and calling
    // that a cheap win teaches the wrong thing about what the model worked from.
    expect(result.ok && result.value.correct).toBe(true)
    expect(result.ok && result.value.sufficient).toBe(false)
  })

  it('records a wrong answer and still closes the session', async () => {
    const session = await start()
    const result = await submitAnswer(store, session.id, 'u1', 'select 2', wrong)

    expect(result.ok && result.value.correct).toBe(false)
    expect(store.rows.get(session.id)?.status).toBe('submitted')
  })

  it('refuses an empty answer without closing the session', async () => {
    const session = await start()
    const result = await submitAnswer(store, session.id, 'u1', '  ', correct)

    expect(!result.ok && result.status).toBe(400)
    expect(store.rows.get(session.id)?.status).toBe('open')
  })

  it('cannot be answered twice', async () => {
    const session = await start()
    await submitAnswer(store, session.id, 'u1', 'select 1', correct)

    const again = await submitAnswer(store, session.id, 'u1', 'select 2', correct)
    expect(!again.ok && again.status).toBe(409)
  })

  it('refuses for another user', async () => {
    const session = await start()
    const checker = vi.fn(correct)
    const result = await submitAnswer(store, session.id, 'u2', 'select 1', checker)

    expect(!result.ok && result.status).toBe(404)
    expect(checker).not.toHaveBeenCalled()
  })

  it('ignores a selection the caller might try to supply', async () => {
    // The ledger belongs to whoever served the content. There is no parameter
    // for the client to pass one, and this test exists so adding one is a
    // deliberate act rather than a convenience.
    const session = await start()
    await selectSource(store, session.id, 'u1', 'docs', content)

    const result = await submitAnswer(store, session.id, 'u1', 'select 1', correct)
    expect(result.ok && result.value.tokensSpent).toBe(6000)
  })
})
