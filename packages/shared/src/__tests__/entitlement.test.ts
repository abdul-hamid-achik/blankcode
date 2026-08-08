import { describe, expect, it } from 'vitest'
import {
  applySubscriptionEvent,
  type BillingState,
  FREE_DAILY_EXPLANATIONS,
  FREE_DAILY_RUNS,
  FREE_DAILY_SUBMISSIONS,
  hasPaidAccess,
  limitsFor,
  mayUse,
} from '../entitlement'

const NOW = new Date('2026-08-07T12:00:00Z')
const LATER = new Date('2026-09-01T00:00:00Z')
const EARLIER = new Date('2026-07-01T00:00:00Z')

const state = (over: Partial<BillingState> = {}): BillingState => ({
  subscriptionStatus: null,
  subscriptionEndsAt: null,
  ...over,
})

describe('hasPaidAccess', () => {
  it('is false for someone who never subscribed', () => {
    expect(hasPaidAccess(state(), NOW)).toBe(false)
  })

  it('is true while active', () => {
    expect(hasPaidAccess(state({ subscriptionStatus: 'active' }), NOW)).toBe(true)
  })

  it('is true while trialing', () => {
    expect(hasPaidAccess(state({ subscriptionStatus: 'trialing' }), NOW)).toBe(true)
  })

  it('is true while past_due', () => {
    // Stripe is retrying the card and the person cancelled nothing. Cutting
    // them off mid-retry over a bank decline loses a customer who was going to
    // keep paying.
    expect(hasPaidAccess(state({ subscriptionStatus: 'past_due' }), NOW)).toBe(true)
  })

  it('keeps access after cancelling until the period actually ends', () => {
    // The days were paid for. Treating cancellation as immediate takes them
    // back.
    const cancelled = state({ subscriptionStatus: 'canceled', subscriptionEndsAt: LATER })
    expect(hasPaidAccess(cancelled, NOW)).toBe(true)
  })

  it('removes access once that date has passed', () => {
    const lapsed = state({ subscriptionStatus: 'canceled', subscriptionEndsAt: EARLIER })
    expect(hasPaidAccess(lapsed, NOW)).toBe(false)
  })

  it('is false for a subscription that never completed', () => {
    expect(hasPaidAccess(state({ subscriptionStatus: 'incomplete' }), NOW)).toBe(false)
    expect(hasPaidAccess(state({ subscriptionStatus: 'incomplete_expired' }), NOW)).toBe(false)
  })

  it('is false when unpaid', () => {
    expect(hasPaidAccess(state({ subscriptionStatus: 'unpaid' }), NOW)).toBe(false)
  })

  it('is false for a status we do not recognise', () => {
    // Stripe adds statuses. An unknown one must not grant access by default.
    expect(hasPaidAccess(state({ subscriptionStatus: 'something_new' }), NOW)).toBe(false)
  })
})

describe('limitsFor', () => {
  it('gives a free account real limits', () => {
    const limits = limitsFor(state(), NOW)
    expect(limits.paid).toBe(false)
    expect(limits.submissionsPerDay).toBe(FREE_DAILY_SUBMISSIONS)
    expect(limits.explanationsPerDay).toBe(FREE_DAILY_EXPLANATIONS)
    expect(limits.runsPerDay).toBe(FREE_DAILY_RUNS)
  })

  it('keeps the free tier at a cost that was actually computed', () => {
    // A submission or run costs ~$0.00082. These caps put a maxed-out free
    // account at about $0.74 a month; changing them changes what free users
    // cost, so the number should move deliberately rather than by drifting.
    expect(FREE_DAILY_SUBMISSIONS).toBe(10)
    expect(FREE_DAILY_EXPLANATIONS).toBe(3)
    expect(FREE_DAILY_RUNS).toBe(20)
  })

  it('lifts them for a paid account', () => {
    const limits = limitsFor(state({ subscriptionStatus: 'active' }), NOW)
    expect(limits.paid).toBe(true)
    expect(limits.submissionsPerDay).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('mayUse', () => {
  const free = limitsFor(state(), NOW)

  it('allows below the limit', () => {
    expect(mayUse(free, 'submission', FREE_DAILY_SUBMISSIONS - 1)).toBe(true)
  })

  it('refuses at the limit', () => {
    expect(mayUse(free, 'submission', FREE_DAILY_SUBMISSIONS)).toBe(false)
  })

  it('meters explanations separately from submissions', () => {
    expect(mayUse(free, 'explanation', FREE_DAILY_EXPLANATIONS)).toBe(false)
    expect(mayUse(free, 'submission', FREE_DAILY_EXPLANATIONS)).toBe(true)
  })

  it('meters runs separately from submissions', () => {
    // The iterate step has its own budget: exhausting runs must not spend
    // submissions, and vice versa.
    expect(mayUse(free, 'run', FREE_DAILY_RUNS)).toBe(false)
    expect(mayUse(free, 'run', FREE_DAILY_RUNS - 1)).toBe(true)
    // A day that exhausted submissions still has runs left.
    expect(mayUse(free, 'submission', FREE_DAILY_SUBMISSIONS)).toBe(false)
    expect(mayUse(free, 'run', FREE_DAILY_SUBMISSIONS)).toBe(true)
  })

  it('allows when the count could not be taken', () => {
    // This gates spend, not access. A database blip must not lock everyone out
    // — the same call the AI budget makes, for the same reason.
    expect(mayUse(free, 'submission', null)).toBe(true)
  })

  it('never limits a paid account', () => {
    const paid = limitsFor(state({ subscriptionStatus: 'active' }), NOW)
    expect(mayUse(paid, 'submission', 10_000)).toBe(true)
  })
})

describe('applySubscriptionEvent', () => {
  it('records an active subscription with its period end', () => {
    expect(
      applySubscriptionEvent({
        status: 'active',
        priceId: 'price_123',
        endsAt: LATER,
        cancelAtPeriodEnd: false,
      })
    ).toEqual({
      subscriptionStatus: 'active',
      subscriptionPriceId: 'price_123',
      subscriptionEndsAt: LATER,
    })
  })

  it('keeps the period end when cancellation is scheduled', () => {
    // Still active, just not renewing. The remaining days are still owed.
    const patch = applySubscriptionEvent({
      status: 'active',
      priceId: 'price_123',
      endsAt: LATER,
      cancelAtPeriodEnd: true,
    })
    expect(patch.subscriptionEndsAt).toEqual(LATER)
  })

  it('clears the period end once the subscription is over', () => {
    // Otherwise hasPaidAccess keeps answering yes from a period that lapsed —
    // the failure where cancelled accounts quietly keep working.
    const patch = applySubscriptionEvent({
      status: 'canceled',
      priceId: 'price_123',
      endsAt: LATER,
      cancelAtPeriodEnd: false,
    })
    expect(patch.subscriptionEndsAt).toBeNull()
    expect(hasPaidAccess({ ...patch }, NOW)).toBe(false)
  })

  it('clears it for an expired incomplete signup too', () => {
    const patch = applySubscriptionEvent({
      status: 'incomplete_expired',
      priceId: null,
      endsAt: LATER,
      cancelAtPeriodEnd: false,
    })
    expect(patch.subscriptionEndsAt).toBeNull()
  })

  it('passes an unrecognised status through rather than inventing one', () => {
    // Stripe's vocabulary is kept verbatim; mapping it into ours at write time
    // is where information gets lost.
    const patch = applySubscriptionEvent({
      status: 'paused',
      priceId: 'price_123',
      endsAt: LATER,
      cancelAtPeriodEnd: false,
    })
    expect(patch.subscriptionStatus).toBe('paused')
    expect(hasPaidAccess({ ...patch }, NOW)).toBe(true)
  })
})
