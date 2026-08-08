import { createDatabaseFromEnv } from '@blankcode/db/client'
import { users } from '@blankcode/db/schema'
import { hasPaidAccess } from '@blankcode/shared'
import { streamText } from 'ai'
import { eq } from 'drizzle-orm'
import { resolveAiModel } from './ai-model'

const FALLBACK_MODEL = process.env['LLM_MODEL'] ?? 'deepseek/deepseek-v4-flash'

/**
 * The gateway model id for this reply.
 *
 * `generateReply` is wired into `takeTurn` as a bare `(messages) => reply`
 * function — `turn-session-service.ts`'s `Generate` type carries no user, so
 * there is nothing to resolve a tier against unless a caller passes one in.
 * `userId` is therefore optional and unused by today's only caller
 * (`turn-sessions/[id]/turns.post.ts`, which has the id in hand but not the
 * plumbing to forward it); a future caller that does pass it gets the user's
 * chosen tier, entitlement-checked the same way the explain route checks it.
 */
async function modelFor(userId?: string): Promise<string> {
  if (!userId) return FALLBACK_MODEL

  const db = createDatabaseFromEnv()
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { aiModel: true, subscriptionStatus: true, subscriptionEndsAt: true },
  })
  if (!user) return FALLBACK_MODEL

  const paid = hasPaidAccess(
    { subscriptionStatus: user.subscriptionStatus, subscriptionEndsAt: user.subscriptionEndsAt },
    new Date()
  )
  return resolveAiModel(user.aiModel, paid)
}

/**
 * The model's reply for a turn. The only part of this feature needing a key.
 *
 * Isolated in its own module so the flow around it can be imported and tested
 * without pulling the gateway in, and imported lazily by the route so a missing
 * key is a 503 rather than a module-load failure.
 */
export async function generateReply(
  messages: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>,
  userId?: string
): Promise<string> {
  const model = await modelFor(userId)
  const result = streamText({
    model,
    system: [
      'You are helping someone build a small piece of software. They have a',
      'strictly limited number of messages, so answer the message you were',
      'given rather than asking what they meant.',
      '',
      'Reply with the code and one or two sentences about what you changed.',
    ].join('\n'),
    messages: messages.map((message) => ({ role: message.role, content: message.content })),
    providerOptions: {
      // Its own tag: this feature is conversation turns, not a two-paragraph
      // explanation, and its cost has to be separable on the bill.
      gateway: { tags: ['app:blankcode', 'feature:turn-budget'] },
    },
  })

  return await result.text
}
