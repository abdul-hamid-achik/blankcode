import { createDatabaseFromEnv } from '@blankcode/db/client'
import { exercises } from '@blankcode/db/schema'
import { eq } from 'drizzle-orm'
import { requireUserId } from '~/server/utils/auth'
import { databaseStore } from '~/server/utils/session-store'
import { startSession } from '~/server/utils/turn-session-service'

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
    columns: { id: true, turnBudget: true },
  })
  if (!exercise) throw createError({ statusCode: 404, statusMessage: 'Exercise not found' })

  // The budget comes from the exercise, not from a constant here: it is the
  // difficulty knob. An exercise that does not declare one is not a turn-budget
  // exercise, and starting a session on it would invent a rule it never had.
  if (!exercise.turnBudget || exercise.turnBudget < 1) {
    throw createError({ statusCode: 404, statusMessage: 'Exercise has no turn budget' })
  }

  try {
    const session = await startSession(databaseStore(db), userId, exercise.id, exercise.turnBudget)
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
