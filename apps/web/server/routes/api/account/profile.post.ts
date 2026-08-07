import { createDatabaseFromEnv } from '@blankcode/db/client'
import { users } from '@blankcode/db/schema'
import { eq } from 'drizzle-orm'
import { requireUserId } from '../../../utils/auth'

/**
 * The save button the settings page pressed into a void.
 *
 * `saveProfile` was a TODO that reported "Profile updated successfully!"
 * without writing anything — the exact kind of lie this product exists to
 * train people to catch. One field, like the reminders endpoint next door:
 * the display name is the only thing the form lets you edit, and a general
 * PATCH is where "update whatever fields arrive" bugs live.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = await readBody<{ displayName?: unknown }>(event)

  if (typeof body?.displayName !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'displayName must be a string' })
  }

  // Trimmed, bounded by the column, and an empty string clears the name
  // rather than storing whitespace that renders as a blank label.
  const displayName = body.displayName.trim().slice(0, 100) || null

  const db = createDatabaseFromEnv()
  await db.update(users).set({ displayName, updatedAt: new Date() }).where(eq(users.id, userId))

  return { displayName }
})
