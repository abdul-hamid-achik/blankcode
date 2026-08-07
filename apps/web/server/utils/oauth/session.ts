import { createHash, randomBytes } from 'node:crypto'
import { createDatabaseFromEnv } from '@blankcode/db/client'
import { refreshTokens } from '@blankcode/db/schema'
import bcrypt from 'bcryptjs'
import * as jose from 'jose'

/**
 * Issues the same session the password login issues.
 *
 * Deliberately byte-for-byte compatible with `auth.service.ts` in the Effect
 * API: same JWT claims, same refresh-token construction (random 64 bytes,
 * bcrypt hash for verification plus a sha256 lookup hash, 30 days). A session
 * that OAuth mints and the API cannot refresh would work until the access
 * token expired and then silently log the person out — a bug that only shows
 * up fifteen minutes after every test passed.
 */
export async function issueSession(
  userId: string,
  email: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const secret = process.env['JWT_SECRET']
  if (!secret) throw createError({ statusCode: 503, statusMessage: 'Auth is not configured' })

  const accessToken = await new jose.SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    // Same default as the API's own config ('7d'). This said '15m' while
    // password logins minted 7-day tokens — so OAuth users hit expiry within
    // minutes of signing in, and any surface that mishandled the 401 read it
    // as "sign in again".
    .setExpirationTime(process.env['JWT_EXPIRES_IN'] ?? '7d')
    .sign(new TextEncoder().encode(secret))

  const token = randomBytes(64).toString('hex')
  const tokenHash = await bcrypt.hash(token, 10)
  const lookupHash = createHash('sha256').update(token).digest('hex')
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 30)

  const db = createDatabaseFromEnv()
  await db.insert(refreshTokens).values({ userId, token: lookupHash, tokenHash, expiresAt })

  return { accessToken, refreshToken: token }
}
