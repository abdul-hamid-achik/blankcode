import { createDatabaseFromEnv } from '@blankcode/db/client'
import { users } from '@blankcode/db/schema'
import { eq } from 'drizzle-orm'
import { requireUserId } from '~/server/utils/auth'
import { isAiTier } from '~/server/utils/ai-model'

/**
 * Sets the caller's AI tier preference.
 *
 * Storing `advanced` without a paid plan is allowed — `resolveAiModel` is
 * where entitlement is enforced, so a lapsed subscription degrades what the
 * tier resolves to rather than blocking the write. Honesty about that lives
 * in the settings UI, not in this endpoint.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = await readBody<{ tier?: unknown }>(event)

  if (!isAiTier(body?.tier)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'tier must be fast, standard, or advanced',
    })
  }

  const db = createDatabaseFromEnv()
  await db
    .update(users)
    .set({ aiModel: body.tier, updatedAt: new Date() })
    .where(eq(users.id, userId))

  return { tier: body.tier }
})
