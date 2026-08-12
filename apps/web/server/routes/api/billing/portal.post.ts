import { createDatabaseFromEnv } from '@blankcode/db/client'
import { users } from '@blankcode/db/schema'
import { eq } from 'drizzle-orm'
import { requireUserId } from '~/server/utils/auth'
import { stripe } from '~/server/utils/stripe'

/**
 * Starts a Stripe billing-portal session so someone can change or cancel
 * what they are already paying for.
 *
 * The customer id is the same `stripeCustomerId` column `checkout.post.ts`
 * writes on first checkout and the webhook keys updates by — there is only
 * one place that id lives, and this reads it rather than creating a second
 * notion of "who this person is to Stripe".
 *
 * A 400, not a 500, when the column is empty: someone who has never checked
 * out has nothing to manage, and that is a normal state for a free account
 * to be in, not a server failure.
 */
export default defineEventHandler(async (event) => {
  const client = stripe()
  if (!client) {
    throw createError({ statusCode: 503, statusMessage: 'Billing is not configured' })
  }

  const userId = await requireUserId(event)
  const db = createDatabaseFromEnv()
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { stripeCustomerId: true },
  })
  if (!user) throw createError({ statusCode: 404, statusMessage: 'User not found' })

  if (!user.stripeCustomerId) {
    throw createError({ statusCode: 400, statusMessage: 'No subscription to manage yet' })
  }

  const site = (useRuntimeConfig().public['siteUrl'] as string).replace(/\/+$/, '')

  const session = await client.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${site}/settings`,
  })

  return { url: session.url }
})
