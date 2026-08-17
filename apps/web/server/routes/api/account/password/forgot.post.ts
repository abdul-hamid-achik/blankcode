import { createDatabaseFromEnv } from '@blankcode/db/client'
import { users } from '@blankcode/db/schema'
import { sql } from 'drizzle-orm'
import { sendEmail } from '~/server/utils/email/send'
import { passwordReset } from '~/server/utils/email/messages'
import { signResetToken } from '~/server/utils/password-reset-token'
import { RESET_MINUTES } from '~/utils/password-reset'

/**
 * Always answers the same way. Whether the address has an account is not
 * something a stranger gets to learn from this form.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: unknown }>(event)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email || !email.includes('@')) {
    throw createError({ statusCode: 400, statusMessage: 'Email is required' })
  }

  const db = createDatabaseFromEnv()
  const user = await db.query.users.findFirst({
    where: sql`lower(${users.email}) = ${email}`,
    columns: { id: true, email: true },
  })

  if (user) {
    const token = await signResetToken(user.id, user.email)
    const site = (useRuntimeConfig().public['siteUrl'] as string).replace(/\/+$/, '')
    await sendEmail(user.email, passwordReset(`${site}/reset?token=${token}`, RESET_MINUTES))
  }

  return { ok: true }
})
