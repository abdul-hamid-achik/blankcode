import {
  type ContextExercise,
  type ContextSource,
  costOf,
  grade,
  type Grade,
} from './context-budget'

/**
 * The context-selection flow.
 *
 * Same shape as the turn-budget service and for the same reason: storage and
 * the one thing that needs judgement — is this answer right — are parameters,
 * so everything that can actually go wrong is testable without either.
 *
 * The property this exists to protect: a source's content is served only after
 * it has been charged for, and the charge is recorded by the server. If the
 * client could report its own selection, the exercise would measure nothing —
 * you would take everything and claim you took one thing.
 */

export interface StoredContextSession {
  readonly id: string
  readonly userId: string
  readonly exerciseId: string
  readonly sources: readonly ContextSource[]
  readonly required: readonly string[]
  readonly selected: readonly string[]
  readonly answer: string | null
  readonly status: 'open' | 'submitted' | 'abandoned'
  readonly revealedAt: Date | null
}

export interface ContextSessionStore {
  load(id: string): Promise<StoredContextSession | null>
  create(input: {
    userId: string
    exerciseId: string
    sources: readonly ContextSource[]
    required: readonly string[]
  }): Promise<StoredContextSession>
  save(id: string, patch: Partial<StoredContextSession>): Promise<StoredContextSession>
}

export type Result<T> = { ok: true; value: T } | { ok: false; reason: string; status: number }

async function own(
  store: ContextSessionStore,
  id: string,
  userId: string
): Promise<StoredContextSession | null> {
  const session = await store.load(id)
  if (!session || session.userId !== userId) return null
  return session
}

function asExercise(session: StoredContextSession): ContextExercise {
  return { sources: session.sources, required: session.required }
}

export async function startContextSession(
  store: ContextSessionStore,
  userId: string,
  exerciseId: string,
  sources: readonly ContextSource[],
  required: readonly string[]
): Promise<StoredContextSession> {
  return store.create({ userId, exerciseId, sources, required })
}

export interface SourceGrant {
  readonly content: string
  readonly tokensSpent: number
  readonly alreadyHeld: boolean
}

/**
 * Hands over one source and charges for it.
 *
 * Asking twice returns the content again and charges nothing — the cost is of
 * having been shown it, not of the request. Charging per request would make a
 * retry after a dropped connection cost the learner points for nothing.
 */
export async function selectSource(
  store: ContextSessionStore,
  id: string,
  userId: string,
  sourceId: string,
  loadContent: (exerciseId: string, sourceId: string) => Promise<string>
): Promise<Result<SourceGrant>> {
  const session = await own(store, id, userId)
  if (!session) return { ok: false, reason: 'not-found', status: 404 }
  if (session.status !== 'open') return { ok: false, reason: 'session-closed', status: 409 }

  if (!session.sources.some((source) => source.id === sourceId)) {
    return { ok: false, reason: 'unknown-source', status: 404 }
  }

  const alreadyHeld = session.selected.includes(sourceId)
  const selected = alreadyHeld ? session.selected : [...session.selected, sourceId]
  if (!alreadyHeld) await store.save(id, { selected })

  return {
    ok: true,
    value: {
      content: await loadContent(session.exerciseId, sourceId),
      tokensSpent: costOf(asExercise(session), { sourceIds: selected }).tokens,
      alreadyHeld,
    },
  }
}

/**
 * Closes the attempt and scores it.
 *
 * The selection used for scoring is the one on the row, never one supplied with
 * the answer. That is the entire integrity of the exercise: the ledger belongs
 * to whoever served the content.
 */
export async function submitAnswer(
  store: ContextSessionStore,
  id: string,
  userId: string,
  answer: string,
  checkAnswer: (exerciseId: string, answer: string) => Promise<boolean>
): Promise<Result<Grade>> {
  const session = await own(store, id, userId)
  if (!session) return { ok: false, reason: 'not-found', status: 404 }
  if (session.status !== 'open') return { ok: false, reason: 'session-closed', status: 409 }
  if (answer.trim().length === 0) {
    return { ok: false, reason: 'empty-answer', status: 400 }
  }

  const correct = await checkAnswer(session.exerciseId, answer)

  await store.save(id, { status: 'submitted', answer, revealedAt: new Date() })

  return {
    ok: true,
    value: grade(asExercise(session), { sourceIds: session.selected }, correct),
  }
}
