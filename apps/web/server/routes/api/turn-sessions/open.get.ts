import { createDatabaseFromEnv } from '@blankcode/db/client'
import { turnSessions } from '@blankcode/db/schema'
import { and, eq } from 'drizzle-orm'
import { requireUserId } from '../../../utils/auth'

/**
 * The caller's open session for an exercise, if one exists.
 *
 * This is how the page decides between "start a session" and "pick up where
 * you left off" — the partial unique index guarantees at most one row, and
 * asking is cheaper than starting and catching the 409.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const exerciseId = getQuery(event)['exerciseId']
  if (typeof exerciseId !== 'string' || !/^[0-9a-f-]{36}$/i.test(exerciseId)) {
    throw createError({ statusCode: 400, statusMessage: 'exerciseId is required' })
  }

  const db = createDatabaseFromEnv()
  const row = await db.query.turnSessions.findFirst({
    where: and(
      eq(turnSessions.userId, userId),
      eq(turnSessions.exerciseId, exerciseId),
      eq(turnSessions.status, 'open')
    ),
    columns: { id: true },
  })

  return { sessionId: row?.id ?? null }
})
