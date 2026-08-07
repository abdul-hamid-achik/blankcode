import { createDatabaseFromEnv } from '@blankcode/db/client'
import { apiTokens } from '@blankcode/db/schema'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { requireUserId } from '../../../utils/auth'

/**
 * The owner's active practice tokens: name, prefix, when it was cut, when it
 * last spoke. `lastUsedAt` is the line that matters — a key you forgot you
 * had, still talking, is the thing this list exists to surface.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const db = createDatabaseFromEnv()

  const rows = await db
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      prefix: apiTokens.tokenPrefix,
      createdAt: apiTokens.createdAt,
      lastUsedAt: apiTokens.lastUsedAt,
    })
    .from(apiTokens)
    .where(and(eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)))
    .orderBy(desc(apiTokens.createdAt))

  return { tokens: rows }
})
