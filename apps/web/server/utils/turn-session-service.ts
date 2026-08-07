import {
  canRevealTests,
  canSpendTurn,
  canSubmit,
  type Outcome,
  type Refusal,
  type SessionState,
  summarise,
} from './turn-session'

/**
 * The turn-budget flow, with its two outside dependencies passed in.
 *
 * Storage and the model are parameters rather than imports because only one of
 * them actually needs a key. Framing "the endpoint needs AI_GATEWAY_API_KEY" as
 * a reason not to build it was wrong: the key is needed for one call, and every
 * other thing that can go wrong here — a turn charged twice, a session resumed
 * after it closed, tests handed over early — is testable today against a stub.
 *
 * So the model is a function. In production it streams from the gateway; in the
 * tests it returns a canned string, and the flow around it is exercised for
 * real.
 */

export interface StoredSession extends SessionState {
  readonly id: string
  readonly userId: string
  readonly exerciseId: string
  readonly messages: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>
  readonly finalCode: string | null
}

export interface SessionStore {
  load(id: string): Promise<StoredSession | null>
  create(input: { userId: string; exerciseId: string; maxTurns: number }): Promise<StoredSession>
  save(id: string, patch: Partial<StoredSession>): Promise<StoredSession>
}

/** Produces the model's reply for a transcript. The only part needing a key. */
export type Generate = (
  messages: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>
) => Promise<string>

export type Result<T> =
  | { ok: true; value: T }
  | Refusal
  | { ok: false; reason: 'not-found'; status: number }

/**
 * Loads a session and checks it belongs to the caller.
 *
 * A missing session and someone else's session return the same thing on
 * purpose. Distinguishing them tells a caller which ids exist, and a session id
 * is the only thing standing between one learner's transcript and another's.
 */
async function own(store: SessionStore, id: string, userId: string): Promise<StoredSession | null> {
  const session = await store.load(id)
  if (!session || session.userId !== userId) return null
  return session
}

export async function startSession(
  store: SessionStore,
  userId: string,
  exerciseId: string,
  maxTurns: number
): Promise<StoredSession> {
  return store.create({ userId, exerciseId, maxTurns })
}

export interface TurnResult {
  readonly reply: string
  readonly turnsUsed: number
  readonly turnsRemaining: number
}

/**
 * Spends one turn.
 *
 * The turn is recorded before the model is called, and the learner's message is
 * saved with it. If generation then fails, the turn is still spent — which is
 * the honest accounting, because the request was made and paid for. Refunding
 * it would make a flaky gateway into free turns.
 */
export async function takeTurn(
  store: SessionStore,
  generate: Generate,
  id: string,
  userId: string,
  message: string
): Promise<Result<TurnResult>> {
  const session = await own(store, id, userId)
  if (!session) return { ok: false, reason: 'not-found', status: 404 }

  const decision = canSpendTurn(session, message)
  if (!decision.ok) return decision

  const withUser = [...session.messages, { role: 'user' as const, content: message }]
  await store.save(id, { turnsUsed: decision.value.turnsAfter, messages: withUser })

  const reply = await generate(withUser)

  const updated = await store.save(id, {
    messages: [...withUser, { role: 'assistant' as const, content: reply }],
  })

  return {
    ok: true,
    value: {
      reply,
      turnsUsed: updated.turnsUsed,
      turnsRemaining: Math.max(0, updated.maxTurns - updated.turnsUsed),
    },
  }
}

export interface SubmitResult {
  readonly outcome: Outcome
  readonly testsReleased: boolean
}

/**
 * Ends the session and releases the tests.
 *
 * Closing and stamping happen in one write. Two writes would leave a window
 * where the session is closed but unstamped, and the reveal rule reads both —
 * so a crash in between would lock the learner out of their own results.
 */
export async function submitSession(
  store: SessionStore,
  id: string,
  userId: string,
  code: string,
  runTests: (code: string, exerciseId: string) => Promise<boolean>
): Promise<Result<SubmitResult>> {
  const session = await own(store, id, userId)
  if (!session) return { ok: false, reason: 'not-found', status: 404 }

  const decision = canSubmit(session)
  if (!decision.ok) return decision

  const passed = await runTests(code, session.exerciseId)

  const closed = await store.save(id, {
    status: 'submitted',
    finalCode: code,
    revealedAt: new Date(),
  })

  return {
    ok: true,
    value: { outcome: summarise(closed, passed), testsReleased: canRevealTests(closed).ok },
  }
}

/** The hidden tests, if this session has earned the right to see them. */
export async function revealTests(
  store: SessionStore,
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
