import { createDatabaseFromEnv } from '@blankcode/db/client'
import { users } from '@blankcode/db/schema'
import { eq } from 'drizzle-orm'
import type Stripe from 'stripe'
import { applySubscriptionEvent } from '@blankcode/shared'
import { stripe, webhookSecret } from '../../../utils/stripe'

/**
 * Where subscription state actually comes from.
 *
 * Not the redirect back from checkout: the customer can close the tab, and a
 * payment that succeeds after they do is still a payment. Every change lands
 * here, keyed by the Stripe customer, which is why that column is indexed.
 *
 * The raw body is required — the signature is over the bytes Stripe sent, and
 * anything that parses and re-serialises the JSON invalidates it.
 */
const HANDLED = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
])

export default defineEventHandler(async (event) => {
  const client = stripe()
  const secret = webhookSecret()
  if (!client || !secret) {
    throw createError({ statusCode: 503, statusMessage: 'Billing is not configured' })
  }

  const signature = getHeader(event, 'stripe-signature')
  const body = await readRawBody(event)
  if (!signature || !body) {
    throw createError({ statusCode: 400, statusMessage: 'Missing signature or body' })
  }

  let received: Stripe.Event
  try {
    received = client.webhooks.constructEvent(body, signature, secret)
  } catch (error) {
    // An unverified event is not ours. Reporting why would help someone
    // guessing at signatures.
    console.error('[billing] signature verification failed:', String(error))
    throw createError({ statusCode: 400, statusMessage: 'Invalid signature' })
  }

  if (!HANDLED.has(received.type)) {
    // 200, not 4xx: an unhandled type is not a failure, and answering with an
    // error makes Stripe retry it forever.
    return { received: true, handled: false }
  }

  const subscription = received.data.object as Stripe.Subscription
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id

  const db = createDatabaseFromEnv()
  const user = await db.query.users.findFirst({
    where: eq(users.stripeCustomerId, customerId),
    columns: { id: true },
  })

  if (!user) {
    // Still 200. A customer we do not know is either from another environment
    // sharing the endpoint or a race with checkout; retrying will not fix it.
    console.error(`[billing] no user for stripe customer ${customerId}`)
    return { received: true, handled: false }
  }

  const item = subscription.items.data[0]
  const periodEnd = item?.current_period_end

  const patch = applySubscriptionEvent({
    status: subscription.status,
    priceId: item?.price?.id ?? null,
    endsAt: periodEnd ? new Date(periodEnd * 1000) : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  })

  await db
    .update(users)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(users.id, user.id))

  return { received: true, handled: true }
})
