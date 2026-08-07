import Stripe from 'stripe'

/**
 * The Stripe client, and the one place that decides whether billing is on.
 *
 * Returns null rather than throwing when the key is absent. Billing is the only
 * part of this product that can be switched off without the rest breaking, and
 * a missing key is the ordinary state of a local run — an exception at module
 * load would take the whole server down over a feature nobody was using.
 */
let client: Stripe | null | undefined

export function stripe(): Stripe | null {
  if (client !== undefined) return client

  const key = process.env['STRIPE_SECRET_KEY']
  client = key ? new Stripe(key) : null
  return client
}

/** The subscription being sold. Its currency options live in Stripe, not here. */
export function priceId(): string | undefined {
  return process.env['STRIPE_PRICE_ID'] || undefined
}

export function webhookSecret(): string | undefined {
  return process.env['STRIPE_WEBHOOK_SECRET'] || undefined
}
