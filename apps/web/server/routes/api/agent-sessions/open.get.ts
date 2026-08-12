import { createDatabaseFromEnv } from '@blankcode/db/client'
import { agentSessions } from '@blankcode/db/schema'
import { and, eq } from 'drizzle-orm'
import { requireUserId } from '~/server/utils/auth'

/** The caller's open sitting for an exercise, if one exists. */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const exerciseId = getQuery(event)['exerciseId']
  if (typeof exerciseId !== 'string' || !/^[0-9a-f-]{36}$/i.test(exerciseId)) {
    throw createError({ statusCode: 400, statusMessage: 'exerciseId is required' })
  }

  const db = createDatabaseFromEnv()
  const row = await db.query.agentSessions.findFirst({
    where: and(
      eq(agentSessions.userId, userId),
      eq(agentSessions.exerciseId, exerciseId),
      eq(agentSessions.status, 'open')
    ),
    columns: { id: true },
  })

  return { sessionId: row?.id ?? null }
})
