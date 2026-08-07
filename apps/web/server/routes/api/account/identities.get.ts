import { createDatabaseFromEnv } from '@blankcode/db/client'
import { linkedIdentities, users } from '@blankcode/db/schema'
import { eq } from 'drizzle-orm'
import { requireUserId } from '../../../utils/auth'

/** The sign-in methods this account has, for the settings page. */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const db = createDatabaseFromEnv()

  const [rows, user] = await Promise.all([
    db.query.linkedIdentities.findMany({
      where: eq(linkedIdentities.userId, userId),
      columns: { provider: true, email: true, createdAt: true },
    }),
    db.query.users.findFirst({ where: eq(users.id, userId), columns: { passwordHash: true } }),
  ])

  return {
    identities: rows,
    // An `oauth:`-prefixed hash is the sentinel for "no password was ever
    // set"; a real bcrypt hash starts with $2. The page needs this to know
    // whether unlinking the only provider would lock the person out.
    hasPassword: Boolean(user?.passwordHash?.startsWith('$2')),
  }
})
