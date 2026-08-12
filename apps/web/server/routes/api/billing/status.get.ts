import { createDatabaseFromEnv } from '@blankcode/db/client'
import { users } from '@blankcode/db/schema'
import { hasPaidAccess } from '@blankcode/shared'
import { eq } from 'drizzle-orm'
import { requireUserId } from '~/server/utils/auth'

/**
 * Whether the caller currently has paid access, and why.
 *
 * Same rule the submission budget, the explain route, and the AI tier
 * resolution enforce with — `hasPaidAccess` over `subscriptionStatus` /
 * `subscriptionEndsAt` — so the settings page and the pricing page never
 * disagree with what actually gates a submission.
 *
 * No Stripe call: the webhook already keeps those two columns current, so
 * this is a row read, not an API round trip.
 *
 * No currency in the response. Adaptive Pricing chooses it at checkout time
 * from the visitor's country and Stripe never sends that choice back to the
 * webhook, so there is nothing here to read it from — inventing one would be
 * exactly the kind of guess this endpoint exists to avoid.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const db = createDatabaseFromEnv()
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { subscriptionStatus: true, subscriptionEndsAt: true },
  })
  if (!user) throw createError({ statusCode: 404, statusMessage: 'User not found' })

  const paid = hasPaidAccess(
    { subscriptionStatus: user.subscriptionStatus, subscriptionEndsAt: user.subscriptionEndsAt },
    new Date()
  )

  return {
    paid,
    status: user.subscriptionStatus,
    endsAt: user.subscriptionEndsAt,
  }
})
