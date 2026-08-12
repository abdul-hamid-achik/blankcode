import { createDatabaseFromEnv } from '@blankcode/db/client'
import { linkedIdentities, users } from '@blankcode/db/schema'
import { and, eq } from 'drizzle-orm'
import { requireUserId } from '~/server/utils/auth'
import { mayUnlink } from '~/server/utils/oauth/linking'
import { isProviderName } from '~/server/utils/oauth/providers'

/**
 * Disconnects a provider.
 *
 * `mayUnlink` decides, and its one hard rule is re-checked here against the
 * database rather than trusted from the client: the last way into an account
 * cannot be removed, and a request forged from a stale page must not get
 * around that.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = await readBody<{ provider?: string }>(event)
  const provider = body?.provider ?? ''
  if (!isProviderName(provider)) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown provider' })
  }

  const db = createDatabaseFromEnv()
  const [rows, user] = await Promise.all([
    db.query.linkedIdentities.findMany({
      where: eq(linkedIdentities.userId, userId),
      columns: { provider: true },
    }),
    db.query.users.findFirst({ where: eq(users.id, userId), columns: { passwordHash: true } }),
  ])

  const linked = rows
    .map((row) => row.provider)
    .filter((name): name is 'github' | 'google' => name === 'github' || name === 'google')
  const hasPassword = Boolean(user?.passwordHash?.startsWith('$2'))

  const verdict = mayUnlink(provider, linked, hasPassword)
  if (!verdict.ok) {
    throw createError({
      statusCode: verdict.reason === 'not-linked' ? 404 : 409,
      statusMessage:
        verdict.reason === 'not-linked'
          ? 'That provider is not linked'
          : 'This is the only way into the account. Set a password or link another provider first.',
    })
  }

  await db
    .delete(linkedIdentities)
    .where(and(eq(linkedIdentities.userId, userId), eq(linkedIdentities.provider, provider)))

  return { removed: provider }
})
