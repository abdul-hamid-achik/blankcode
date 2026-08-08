import { createDatabaseFromEnv } from '@blankcode/db/client'
import { users } from '@blankcode/db/schema'
import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import * as jose from 'jose'

/**
 * The caller's user id, or a 401.
 *
 * Pulled out of the explain endpoint when the turn-session routes needed the
 * same thing. Three copies of a token check is how one of them ends up subtly
 * more permissive than the others — and the review caught exactly that: the
 * Effect API's Authorization middleware loads the user row and refuses a
 * token whose account is gone, while this helper trusted `sub` alone. The
 * moment account deletion or a ban flag ships, a still-valid access token
 * would have kept full access to every Nitro route. Both doors now ask the
 * same question.
 */
export async function requireUserId(event: H3Event): Promise<string> {
  const authorization = getHeader(event, 'authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null
  if (!token) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  let sub: string
  try {
    const verified = await jose.jwtVerify(
      token,
      new TextEncoder().encode(process.env['JWT_SECRET'] ?? '')
    )
    if (!verified.payload.sub) throw new Error('no subject')
    sub = verified.payload.sub
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const db = createDatabaseFromEnv()
  const user = await db.query.users.findFirst({
    where: eq(users.id, sub),
    columns: { id: true },
  })
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  return user.id
}
