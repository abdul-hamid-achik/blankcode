import { createDatabaseFromEnv } from '@blankcode/db/client'
import { users } from '@blankcode/db/schema'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { verifyResetToken } from '~/server/utils/password-reset-token'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ token?: unknown; password?: unknown }>(event)
  const token = typeof body?.token === 'string' ? body.token : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'This reset link is missing its token.' })
  }
  if (password.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'Password must be at least 8 characters' })
  }

  const claims = await verifyResetToken(token)
  const passwordHash = await bcrypt.hash(password, 12)

  const db = createDatabaseFromEnv()
  const updated = await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, claims.sub))
    .returning({ id: users.id })

  if (updated.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'This reset link is invalid or has expired. Request a new one.',
    })
  }

  return { ok: true }
})
