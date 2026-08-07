import { createDatabaseFromEnv } from '@blankcode/db/client'
import { exercises } from '@blankcode/db/schema'
import { eq } from 'drizzle-orm'
import { requireUserId } from '../../../utils/auth'
import { databaseStore } from '../../../utils/session-store'
import { startSession } from '../../../utils/turn-session-service'

/** Turns are fixed at creation, so changing this default cannot move a session already running. */
const DEFAULT_MAX_TURNS = 3

/** Postgres unique-violation, wherever it sits in the cause chain. */
function isUniqueViolation(error: unknown): boolean {
  for (let current = error; current; current = (current as { cause?: unknown }).cause) {
    if ((current as { code?: string }).code === '23505') return true
  }
  return false
}

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = await readBody<{ exerciseId?: string }>(event)
  if (!body?.exerciseId) {
    throw createError({ statusCode: 400, statusMessage: 'exerciseId is required' })
  }

  const db = createDatabaseFromEnv()
  const exercise = await db.query.exercises.findFirst({
    where: eq(exercises.id, body.exerciseId),
    columns: { id: true },
  })
  if (!exercise) throw createError({ statusCode: 404, statusMessage: 'Exercise not found' })

  try {
    const session = await startSession(databaseStore(db), userId, exercise.id, DEFAULT_MAX_TURNS)
    return {
      id: session.id,
      maxTurns: session.maxTurns,
      turnsUsed: session.turnsUsed,
    }
  } catch (error) {
    // The partial unique index. Starting a second session for the same exercise
    // to get a fresh budget is the thing the budget exists to prevent, so this
    // is a conflict to report rather than an error to hide.
    //
    // Matched on the SQLSTATE rather than on the message: drizzle's own message
    // is the failing query, and the constraint violation is a level down in
    // `cause`. Matching text returned a 500 here until it was actually run.
    if (isUniqueViolation(error)) {
      throw createError({ statusCode: 409, statusMessage: 'A session for this exercise is open' })
    }
    throw error
  }
})
