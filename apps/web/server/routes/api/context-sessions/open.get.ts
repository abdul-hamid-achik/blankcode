import { createDatabaseFromEnv } from '@blankcode/db/client'
import { contextSessions } from '@blankcode/db/schema'
import { and, eq } from 'drizzle-orm'
import { requireUserId } from '../../../utils/auth'

/**
 * The caller's open context session for an exercise, if one exists — how the
 * page decides between "start" and "pick up the receipt where it left off".
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const exerciseId = getQuery(event)['exerciseId']
  if (typeof exerciseId !== 'string' || !/^[0-9a-f-]{36}$/i.test(exerciseId)) {
    throw createError({ statusCode: 400, statusMessage: 'exerciseId is required' })
  }

  const db = createDatabaseFromEnv()
  const row = await db.query.contextSessions.findFirst({
    where: and(
      eq(contextSessions.userId, userId),
      eq(contextSessions.exerciseId, exerciseId),
      eq(contextSessions.status, 'open')
    ),
    columns: { id: true },
  })

  return { sessionId: row?.id ?? null }
})
