import { createDatabaseFromEnv } from '@blankcode/db/client'
import { users } from '@blankcode/db/schema'
import { eq } from 'drizzle-orm'
import { requireUserId } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const db = createDatabaseFromEnv()
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { reviewRemindersEnabled: true },
  })
  if (!user) throw createError({ statusCode: 404, statusMessage: 'User not found' })
  return { enabled: user.reviewRemindersEnabled }
})
