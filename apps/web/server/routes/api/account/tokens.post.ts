import { createDatabaseFromEnv } from '@blankcode/db/client'
import { apiTokens } from '@blankcode/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { requireUserId } from '../../../utils/auth'
import { mintPracticeToken } from '../../../utils/practice-tokens'

/**
 * Mint a practice token.
 *
 * Session-authed on purpose: a practice token must never mint another one —
 * the blast radius of a leaked key stays "someone practices as you", and the
 * page where you approve a new key is always a page where you are you.
 *
 * The response is the only time the secret exists outside the caller's
 * clipboard. The row keeps its hash and its first characters, nothing more.
 */
const MAX_ACTIVE_TOKENS = 10

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = await readBody<{ name?: unknown }>(event)

  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 100) : ''
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Give the token a name' })
  }

  const db = createDatabaseFromEnv()

  // A cap, not a quota: nobody needs eleven active keys, and a runaway
  // minting loop should hit a wall before it hits the table.
  const active = await db
    .select({ id: apiTokens.id })
    .from(apiTokens)
    .where(and(eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)))
  if (active.length >= MAX_ACTIVE_TOKENS) {
    throw createError({
      statusCode: 400,
      statusMessage: `You already have ${MAX_ACTIVE_TOKENS} active tokens. Revoke one first.`,
    })
  }

  const minted = await mintPracticeToken()
  const [row] = await db
    .insert(apiTokens)
    .values({
      userId,
      name,
      token: minted.lookupHash,
      tokenPrefix: minted.displayPrefix,
    })
    .returning({ id: apiTokens.id, name: apiTokens.name, createdAt: apiTokens.createdAt })

  if (!row) throw createError({ statusCode: 500, statusMessage: 'Could not create the token' })

  return {
    id: row.id,
    name: row.name,
    prefix: minted.displayPrefix,
    createdAt: row.createdAt,
    // Shown once. The server forgets it the moment this response is sent.
    token: minted.token,
  }
})
