/**
 * What a subscription entitles someone to.
 *
 * No Stripe and no database in here, for the same reason the turn-budget rules
 * have neither: this is the part that decides whether somebody is charged
 * correctly and whether somebody who paid gets what they paid for. Both of
 * those are worth being able to test exhaustively without a network.
 *
 * The plan limits are deliberately not prices. What a free account may do is a
 * product decision that has been made; what the paid one costs has not, and
 * putting an invented number in here to make the module look finished would be
 * the one thing in it that is a guess.
 */

/*
 * Status is a plain string here, not a union of Stripe's eight values
 * (`active`, `trialing`, `past_due`, `canceled`, `incomplete`,
 * `incomplete_expired`, `unpaid`, `paused`).
 *
 * A closed union would have to be widened every time Stripe adds one, and until
 * someone did, an unrecognised status would fail to typecheck at the boundary
 * and tempt whoever hit it into mapping it onto the nearest known value. Open
 * string, stored verbatim, and `hasPaidAccess` denies anything it does not
 * recognise — asserted by a test.
 */

export interface BillingState {
  readonly subscriptionStatus: string | null
  /** When paid access lapses. Null while there has never been a subscription. */
  readonly subscriptionEndsAt: Date | null
}

/** What a free account may do in a day. A decision, not a guess. */
export const FREE_DAILY_SUBMISSIONS = 20
export const FREE_DAILY_EXPLANATIONS = 5

export interface Limits {
  readonly submissionsPerDay: number
  readonly explanationsPerDay: number
  readonly paid: boolean
}

const UNLIMITED = Number.POSITIVE_INFINITY

const FREE: Limits = {
  submissionsPerDay: FREE_DAILY_SUBMISSIONS,
  explanationsPerDay: FREE_DAILY_EXPLANATIONS,
  paid: false,
}

const PAID: Limits = {
  submissionsPerDay: UNLIMITED,
  explanationsPerDay: UNLIMITED,
  paid: true,
}

/**
 * Whether this person currently has paid access.
 *
 * Two statuses count and the reasons differ. `active` is the ordinary one.
 * `past_due` also counts: Stripe is retrying the card, the person has not
 * cancelled anything, and cutting them off mid-retry over a bank decline is how
 * you lose a customer who was going to keep paying.
 *
 * `canceled` is deliberately not checked here. A cancelled subscription still
 * has time left on it — that is what `subscriptionEndsAt` is for, and treating
 * cancellation as immediate takes away days somebody already paid for.
 */
export function hasPaidAccess(state: BillingState, now: Date): boolean {
  const status = state.subscriptionStatus

  if (status === 'active' || status === 'trialing' || status === 'past_due') return true

  // Cancelled, but paid through a date that has not arrived yet.
  if (state.subscriptionEndsAt && state.subscriptionEndsAt > now) return true

  return false
}

export function limitsFor(state: BillingState, now: Date): Limits {
  return hasPaidAccess(state, now) ? PAID : FREE
}

/**
 * Whether one more of something is allowed.
 *
 * `usedToday` comes from counting rows, and a caller that could not count
 * passes null. That is treated as allowed: this gates spend, not access, and a
 * database blip should not lock everyone out of the product. The same choice as
 * the AI budget, made the same way for the same reason.
 */
export function mayUse(
  limits: Limits,
  kind: 'submission' | 'explanation',
  usedToday: number | null
): boolean {
  if (usedToday === null) return true
  const cap = kind === 'submission' ? limits.submissionsPerDay : limits.explanationsPerDay
  return usedToday < cap
}

/**
 * What a Stripe subscription event means for our row.
 *
 * Pure, so the mapping can be tested against every status Stripe sends without
 * a webhook, a signature, or an account.
 */
export interface SubscriptionEvent {
  readonly status: string
  readonly priceId: string | null
  /** `current_period_end`, already converted from Stripe's seconds. */
  readonly endsAt: Date | null
  readonly cancelAtPeriodEnd: boolean
}

export interface BillingPatch {
  readonly subscriptionStatus: string | null
  readonly subscriptionPriceId: string | null
  readonly subscriptionEndsAt: Date | null
}

export function applySubscriptionEvent(event: SubscriptionEvent): BillingPatch {
  /*
   * A subscription that is over leaves no end date behind. Keeping the old one
   * would leave `hasPaidAccess` answering yes from a period that already
   * lapsed — the failure mode where cancelled accounts quietly keep working.
   */
  const finished = event.status === 'canceled' || event.status === 'incomplete_expired'

  return {
    subscriptionStatus: event.status,
    subscriptionPriceId: event.priceId,
    subscriptionEndsAt: finished ? null : event.endsAt,
  }
}
