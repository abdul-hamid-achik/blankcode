import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The `/api/billing/status` endpoint, asserted at the source.
 *
 * The one property worth pinning: entitlement here must be computed the same
 * way the submission budget, the explain route, and the AI tier resolution
 * compute it. A second definition of "paid" is how the settings page ends up
 * telling someone they are on Pro while the API still throttles them at ten
 * submissions a day.
 */

const ROUTE = join(process.cwd(), 'server/routes/api/billing/status.get.ts')
const source = readFileSync(ROUTE, 'utf-8')

describe('the billing status endpoint', () => {
  it('requires a session', () => {
    expect(source).toContain('requireUserId')
  })

  it('computes paid access with the shared rule, not its own logic', () => {
    expect(source).toContain("import { hasPaidAccess } from '@blankcode/shared'")
    expect(source).toContain('hasPaidAccess(')
  })

  it('reads only the two columns the rule needs, no Stripe call', () => {
    expect(source).toContain('subscriptionStatus: true, subscriptionEndsAt: true')
    expect(source).not.toContain('stripe(')
  })

  it('never invents a currency the row does not carry', () => {
    // `stripeCustomerId` and the subscription columns exist; a per-user
    // currency does not. Returning one would be a guess dressed as a fact.
    expect(source).not.toContain('currency:')
  })

  it('404s a caller with no user row', () => {
    expect(source).toContain('statusCode: 404')
  })
})
