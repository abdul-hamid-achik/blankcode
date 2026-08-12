import { createDatabaseFromEnv } from '@blankcode/db/client'
import { apiTokens } from '@blankcode/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { requireUserId } from '~/server/utils/auth'

/**
 * Revocation is a timestamp, not a delete: the row keeps its place so
 * submissions made with the key stay attributable after the key dies.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    throw createError({ statusCode: 404, statusMessage: 'Token not found' })
  }

  const db = createDatabaseFromEnv()
  const [revoked] = await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)))
    .returning({ id: apiTokens.id })

  if (!revoked) throw createError({ statusCode: 404, statusMessage: 'Token not found' })
  return { revoked: true }
})
