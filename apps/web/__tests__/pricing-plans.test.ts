import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The pricing section is built and deliberately not mounted.
 *
 * These tests exist so it stays that way by decision rather than by accident:
 * mounting it is a one-line change, and the one-line change should not happen
 * while the prices are still blank.
 */

const component = readFileSync(join(process.cwd(), 'components/landing/pricing-plans.vue'), 'utf-8')
const page = readFileSync(join(process.cwd(), 'pages/index.vue'), 'utf-8')

describe('pricing section', () => {
  it('is on the landing page', () => {
    expect(page).toContain('<PricingPlans')
  })

  it('shows the price the Stripe price actually charges', () => {
    // These are published promises. If the Stripe price changes and this does
    // not, the site lies about what a card will be charged — so the two move
    // together or this test fails.
    expect(component).toContain("price: '$12'")
    expect(component).toContain('MXN 219')
    expect(component).toContain('EUR 11')
  })

  it('states the free limit that the server actually enforces', () => {
    // `entitlement.ts` caps free accounts at ten a day. A page promising a
    // different number is a support ticket.
    expect(component).toContain('10 submissions, 20 runs, and 3 explanations a day')
  })

  it('sells the thing that costs money to serve', () => {
    // Submissions run a microVM each. Charging per seat with unlimited
    // execution puts the exposure on the wrong side.
    expect(component).toContain('10 submissions, 20 runs, and 3 explanations a day')
    expect(component).toContain('No daily submission, run, or explanation cap')
    expect(component).toContain("name: 'Pro'")
    expect(component).not.toContain('The full review queue')
  })
})
