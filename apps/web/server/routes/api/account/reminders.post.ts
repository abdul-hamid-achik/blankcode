import { createDatabaseFromEnv } from '@blankcode/db/client'
import { users } from '@blankcode/db/schema'
import { eq } from 'drizzle-orm'
import { requireUserId } from '../../../utils/auth'

/**
 * The opt-out the reminder email promises.
 *
 * A one-field endpoint instead of a general settings PATCH, because the only
 * caller is the toggle and a general endpoint is where "update whatever fields
 * arrive" bugs live.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = await readBody<{ enabled?: boolean }>(event)
  if (typeof body?.enabled !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'enabled must be a boolean' })
  }

  const db = createDatabaseFromEnv()
  await db
    .update(users)
    .set({ reviewRemindersEnabled: body.enabled, updatedAt: new Date() })
    .where(eq(users.id, userId))

  return { enabled: body.enabled }
})
