import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The `/api/billing/portal` endpoint, asserted at the source.
 *
 * The failure this guards against returns no page at all: a customer id that
 * is missing (never checked out) or wrong (read from somewhere other than
 * where checkout and the webhook write it) either 500s or opens someone
 * else's billing portal. Neither is recoverable from a screenshot, so this is
 * a source test rather than a request test.
 */

const ROUTE = join(process.cwd(), 'server/routes/api/billing/portal.post.ts')
const source = readFileSync(ROUTE, 'utf-8')

describe('the billing portal endpoint', () => {
  it('requires a session', () => {
    expect(source).toContain('requireUserId')
  })

  it('reuses the exact customer id column checkout and the webhook use', () => {
    // `checkout.post.ts` writes this column and `webhook.post.ts` keys updates
    // by it. A second id (e.g. looked up by email) would be a second, driftable
    // notion of who this person is to Stripe.
    expect(source).toContain('stripeCustomerId: true')
    expect(source).toContain('user.stripeCustomerId')
  })

  it('answers a customer-less account with a 400, never a 500', () => {
    expect(source).toContain('if (!user.stripeCustomerId)')
    expect(source).toContain('statusCode: 400')
    expect(source).toContain('No subscription to manage yet')
  })

  it('checks the 400 before calling Stripe', () => {
    // Order matters: creating a portal session for a customer id that does
    // not exist is exactly the request that should never be attempted.
    const guard = source.indexOf('statusCode: 400')
    const call = source.indexOf('billingPortal.sessions.create')
    expect(guard).toBeGreaterThan(-1)
    expect(call).toBeGreaterThan(guard)
  })

  it('degrades to a clear error when billing is not configured', () => {
    expect(source).toContain('statusCode: 503')
  })

  it('returns the caller to settings, not to Stripe', () => {
    expect(source).toContain('/settings')
  })
})
