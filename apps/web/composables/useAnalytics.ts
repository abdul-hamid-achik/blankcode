import { track } from '@vercel/analytics'

/**
 * Custom events.
 *
 * A closed set, because the alternative is a `track(name, props)` call scattered
 * through components and a dashboard nobody can read six weeks later. Naming
 * them here also makes it obvious what is being collected, which matters: the
 * privacy policy has to stay true.
 *
 * Nothing here carries who did it. Vercel Analytics is not tied to an account,
 * and adding a user id or an email would turn an aggregate counter into
 * behavioural tracking of a named person — a different thing, with different
 * obligations, that we did not tell anyone we do.
 *
 * The properties are all low-cardinality on purpose. An exercise slug is fine;
 * a submission id would produce one bucket per event and answer nothing.
 */

type Properties = Record<string, string | number | boolean | null>

interface Events {
  /** Someone ran the fill-in-the-blank demo on the landing page. */
  'demo-run': { passed: boolean }
  /** An account was created. The funnel's only real conversion. */
  signup: { method: 'password' }
  /** A submission finished. `passed` is the thing worth a chart. */
  'submission-graded': { track: string; exercise: string; passed: boolean }
  /** Someone asked for an explanation of a failure. Costs money per press. */
  'explanation-requested': { track: string }
  /** A hint was revealed. High counts on one exercise mean it is unclear. */
  'hint-revealed': { exercise: string; index: number }
  /** Checkout started. Paired with the Stripe webhook, this gives drop-off. */
  'checkout-started': { currency: string }
  /** A free account hit its daily cap — the signal the limit is doing work. */
  'limit-reached': { kind: 'submission' | 'explanation' }
}

/**
 * Sends one event.
 *
 * Client-only and silent when analytics is not injected, which is every local
 * run: `@vercel/analytics` no-ops off-platform, and a product feature must not
 * depend on a counter having been delivered.
 */
export function useAnalytics() {
  function emit<K extends keyof Events>(name: K, properties: Events[K]): void {
    if (import.meta.server) return
    try {
      track(name, properties as Properties)
    } catch (error) {
      // Never let a metric break a page.
      console.error(`[analytics] ${String(name)} failed:`, String(error))
    }
  }

  return { emit }
}
