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
  it('is not on the landing page yet', () => {
    // A price is the one piece of copy a visitor may treat as a promise, so
    // this must not go live before the numbers are real.
    expect(page).not.toContain('<PricingPlans')
  })

  it('has a slot waiting for it, so mounting it moves nothing else', () => {
    expect(page).toContain('pricing-plans.vue')
  })

  it('carries no invented prices', () => {
    // The guard that matters. If someone fills these in, the test above is what
    // then has to be changed deliberately to publish them.
    const prices = [...component.matchAll(/price:\s*'([^']*)'/g)].map((match) => match[1])
    expect(prices.length).toBeGreaterThan(0)
    expect(prices.every((price) => price === '')).toBe(true)
  })

  it('renders a dash rather than a guess when a price is unset', () => {
    expect(component).toContain("plan.price || '—'")
  })

  it('sells the thing that costs money to serve', () => {
    // Submissions run a microVM each. Charging per seat with unlimited
    // execution puts the exposure on the wrong side.
    expect(component).toContain('daily submission limit')
    expect(component).toContain('No daily submission limit')
  })
})
