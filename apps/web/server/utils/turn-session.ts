/**
 * The rules of a turn-budget session.
 *
 * Deliberately free of the database and of the model: everything here is a pure
 * decision about what a session in a given state is allowed to do next. That is
 * the part worth testing exhaustively, and the part that is worthless if it is
 * wrong — a budget that can be got around is not a constraint, it is decoration,
 * and the exercise stops teaching anything the moment it can be.
 */

export type SessionStatus = 'open' | 'submitted' | 'abandoned'

export interface SessionState {
  readonly status: SessionStatus
  readonly maxTurns: number
  readonly turnsUsed: number
  readonly revealedAt: Date | null
}

export type Refusal =
  | { readonly ok: false; readonly reason: 'session-closed'; readonly status: number }
  | { readonly ok: false; readonly reason: 'no-turns-left'; readonly status: number }
  | { readonly ok: false; readonly reason: 'not-revealed'; readonly status: number }
  | { readonly ok: false; readonly reason: 'empty-message'; readonly status: number }

export type Decision<T> = { readonly ok: true; readonly value: T } | Refusal

/** Turns still available. Never negative, even if the row says something odd. */
export function turnsRemaining(session: SessionState): number {
  return Math.max(0, session.maxTurns - session.turnsUsed)
}

/**
 * Whether the learner may send another message.
 *
 * The budget is checked here rather than after the model replies, because the
 * cost is incurred by asking. Counting on the way out means the last turn is
 * always free, which sounds harmless and makes a budget of three a budget of
 * four.
 */
export function canSpendTurn(
  session: SessionState,
  message: string
): Decision<{ turnsAfter: number }> {
  if (session.status !== 'open') {
    return { ok: false, reason: 'session-closed', status: 409 }
  }
  if (message.trim().length === 0) {
    // An empty message would otherwise burn a turn on nothing, which reads as
    // the app eating the budget rather than the learner spending it.
    return { ok: false, reason: 'empty-message', status: 400 }
  }
  if (turnsRemaining(session) <= 0) {
    return { ok: false, reason: 'no-turns-left', status: 429 }
  }
  return { ok: true, value: { turnsAfter: session.turnsUsed + 1 } }
}

/**
 * Whether the session may still be ended by the learner.
 *
 * Running out of turns does not end a session. The last thing that happens in
 * this exercise is the learner deciding the code is good enough and submitting
 * it — that judgement is most of the point, so spending the final turn must not
 * take it away from them.
 */
export function canSubmit(session: SessionState): Decision<true> {
  if (session.status !== 'open') {
    return { ok: false, reason: 'session-closed', status: 409 }
  }
  return { ok: true, value: true }
}

/**
 * Whether the hidden tests may be served.
 *
 * The one rule the exercise cannot survive losing. Tests visible during the
 * session get pasted to the model, and then the thing being practised is
 * pasting. They are released only after the session is closed and stamped.
 */
export function canRevealTests(session: SessionState): Decision<true> {
  if (session.status === 'open' || session.revealedAt === null) {
    return { ok: false, reason: 'not-revealed', status: 403 }
  }
  return { ok: true, value: true }
}

/**
 * How a finished session is scored.
 *
 * Passing is the outcome; turns spent is the interesting part. Solving in two
 * of three is a better result than solving in three, and a summary that hides
 * that teaches the opposite of the lesson — so `turnsUsed` travels with the
 * verdict rather than being dropped once the tests are green.
 */
export interface Outcome {
  readonly passed: boolean
  readonly turnsUsed: number
  readonly maxTurns: number
  readonly turnsSpared: number
}

export function summarise(session: SessionState, passed: boolean): Outcome {
  return {
    passed,
    turnsUsed: session.turnsUsed,
    maxTurns: session.maxTurns,
    turnsSpared: turnsRemaining(session),
  }
}
