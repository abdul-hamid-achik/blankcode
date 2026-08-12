import { createDatabaseFromEnv } from '@blankcode/db/client'
import { users } from '@blankcode/db/schema'
import { hasPaidAccess } from '@blankcode/shared'
import { eq } from 'drizzle-orm'
import { requireUserId } from '~/server/utils/auth'
import { AI_TIERS, DEFAULT_TIER, isAiTier } from '~/server/utils/ai-model'

/**
 * The caller's AI tier and the ladder to choose from.
 *
 * `paid` is read the same way the submission budget and the explain route
 * read it — `hasPaidAccess` over `subscriptionStatus`/`subscriptionEndsAt` —
 * so the settings page and server-side resolution never disagree about who
 * is on a plan.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const db = createDatabaseFromEnv()
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { aiModel: true, subscriptionStatus: true, subscriptionEndsAt: true },
  })
  if (!user) throw createError({ statusCode: 404, statusMessage: 'User not found' })

  const paid = hasPaidAccess(
    { subscriptionStatus: user.subscriptionStatus, subscriptionEndsAt: user.subscriptionEndsAt },
    new Date()
  )

  return {
    tier: isAiTier(user.aiModel) ? user.aiModel : DEFAULT_TIER,
    paid,
    tiers: (Object.keys(AI_TIERS) as Array<keyof typeof AI_TIERS>).map((id) => ({
      id,
      label: AI_TIERS[id].label,
      blurb: AI_TIERS[id].blurb,
      paidOnly: AI_TIERS[id].paidOnly,
    })),
  }
})
