import type { H3Event } from 'h3'
import * as jose from 'jose'

/**
 * The caller's user id, or a 401.
 *
 * Pulled out of the explain endpoint when the turn-session routes needed the
 * same thing. Three copies of a token check is how one of them ends up subtly
 * more permissive than the others.
 */
export async function requireUserId(event: H3Event): Promise<string> {
  const authorization = getHeader(event, 'authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null
  if (!token) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  try {
    const verified = await jose.jwtVerify(
      token,
      new TextEncoder().encode(process.env['JWT_SECRET'] ?? '')
    )
    if (!verified.payload.sub) throw new Error('no subject')
    return verified.payload.sub
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
}
