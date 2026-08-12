import { createDatabaseFromEnv } from '@blankcode/db/client'
import { users } from '@blankcode/db/schema'
import { eq } from 'drizzle-orm'
import { requireUserId } from '~/server/utils/auth'
import { priceId, stripe } from '~/server/utils/stripe'

/**
 * Starts a checkout for the subscription.
 *
 * The Stripe customer is created here on first checkout rather than at signup:
 * most accounts never buy anything, and a customer record for every one of them
 * is a second user table to keep in step for no benefit.
 */
/**
 * Countries where the price carries an exact amount, so the visitor sees a
 * round number instead of a conversion.
 *
 * Everything else is deliberately absent: leaving the session's currency unset
 * lets Adaptive Pricing pick the local one, and there the customer pays the
 * 2–4% conversion rather than us. Naming a currency we have no explicit amount
 * for would make Stripe convert on our side, which this account settles out of
 * MXN and therefore pays for.
 */
const EURO_COUNTRIES = new Set([
  'AT',
  'BE',
  'CY',
  'DE',
  'EE',
  'ES',
  'FI',
  'FR',
  'GR',
  'HR',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'PT',
  'SI',
  'SK',
])

function explicitCurrencyFor(country: string | undefined): 'mxn' | 'usd' | 'eur' | undefined {
  if (!country) return undefined
  if (country === 'MX') return 'mxn'
  if (country === 'US') return 'usd'
  if (EURO_COUNTRIES.has(country)) return 'eur'
  return undefined
}

export default defineEventHandler(async (event) => {
  const client = stripe()
  const price = priceId()
  if (!client || !price) {
    throw createError({ statusCode: 503, statusMessage: 'Billing is not configured' })
  }

  const userId = await requireUserId(event)
  const db = createDatabaseFromEnv()
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, email: true, stripeCustomerId: true },
  })
  if (!user) throw createError({ statusCode: 404, statusMessage: 'User not found' })

  let customerId = user.stripeCustomerId
  if (!customerId) {
    const customer = await client.customers.create({
      email: user.email,
      // So a webhook can find our user even if the row is mid-write.
      metadata: { userId: user.id },
    })
    customerId = customer.id
    await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, user.id))
  }

  const site = (useRuntimeConfig().public['siteUrl'] as string).replace(/\/+$/, '')
  const currency = explicitCurrencyFor(getHeader(event, 'x-vercel-ip-country'))

  const session = await client.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price, quantity: 1 }],
    success_url: `${site}/settings?checkout=done`,
    cancel_url: `${site}/settings?checkout=cancelled`,
    // Only set for the three currencies the price carries an exact amount for.
    // Left unset everywhere else so Adaptive Pricing can choose the visitor's
    // local currency — the customer pays the conversion in that case, we do not.
    ...(currency ? { currency } : {}),
    allow_promotion_codes: true,
  })

  if (!session.url) {
    throw createError({ statusCode: 502, statusMessage: 'Stripe returned no checkout URL' })
  }

  // The currency the server actually chose (null when Adaptive Pricing
  // decides at Stripe) — so the analytics event reports truth, not a guess.
  return { url: session.url, currency: currency ?? null }
})
