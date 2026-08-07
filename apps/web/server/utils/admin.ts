import { createDatabaseFromEnv } from '@blankcode/db/client'
import { users } from '@blankcode/db/schema'
import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { requireUserId } from './auth'

/**
 * Who may see the operator view.
 *
 * Checked against the database rather than against a claim in the token: the
 * JWT carries an email, and trusting it would mean anyone who could mint a
 * token with an admin address in it becomes an admin. The token establishes
 * *which user*; the row establishes what that user's address actually is.
 *
 * An empty ADMIN_EMAILS denies everyone. The other reading — an unset variable
 * means no restriction — is how a misconfigured deployment publishes its own
 * usage data.
 */
export async function requireAdmin(event: H3Event): Promise<string> {
  const userId = await requireUserId(event)

  const allowed = (process.env['ADMIN_EMAILS'] ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)

  if (allowed.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const db = createDatabaseFromEnv()
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { email: true },
  })

  if (!user || !allowed.includes(user.email.toLowerCase())) {
    // 404, not 403. A 403 confirms the page exists to someone who guessed the
    // URL; there is no reason to tell them.
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  return userId
}
