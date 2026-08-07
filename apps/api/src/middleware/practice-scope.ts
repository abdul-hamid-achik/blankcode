/**
 * What a practice token is allowed to touch.
 *
 * An allowlist, not a blocklist: a new route is refused to agents until
 * someone decides otherwise, which is the failure mode you want. The scope is
 * exactly the practice loop — read the catalogue, read your own progress and
 * queue, submit code. Everything with consequences beyond practice (billing,
 * settings, OAuth, minting more tokens) lives outside this list, and most of
 * it lives outside this API entirely, behind session-only Nitro routes.
 *
 * Two deliberate exclusions worth naming:
 * - POST /reviews/:id/complete — the recall rating is the human's self-report
 *   about the human's memory. An agent rating your recall corrupts the very
 *   schedule the product is built on, so the write stays with the hands.
 * - Anything under /auth except `me` — a token that can refresh sessions or
 *   change credentials is not a practice token any more.
 */

const RULES: ReadonlyArray<{ method: 'GET' | 'POST'; pattern: RegExp }> = [
  // The catalogue.
  { method: 'GET', pattern: /^\/tracks(\/|$)/ },
  { method: 'GET', pattern: /^\/exercises(\/|$)/ },
  { method: 'GET', pattern: /^\/paths(\/|$)/ },

  // The learner's own state.
  { method: 'GET', pattern: /^\/progress(\/|$)/ },
  { method: 'GET', pattern: /^\/reviews\/due(\/count)?$/ },
  { method: 'GET', pattern: /^\/reviews\/upcoming$/ },
  { method: 'GET', pattern: /^\/auth\/me$/ },

  // The loop itself.
  { method: 'POST', pattern: /^\/submissions$/ },
  { method: 'GET', pattern: /^\/submissions(\/|$)/ },
]

/** `path` is the pathname with any `/api` mount prefix already stripped. */
export function practiceScopeAllows(method: string, path: string): boolean {
  const normalized = path.replace(/\/+$/, '') || '/'
  return RULES.some((rule) => rule.method === method && rule.pattern.test(normalized))
}

/** Strips the mount prefix so rules read like the API definition does. */
export function apiPathOf(url: string): string {
  const pathname = url.split('?')[0] ?? ''
  return pathname.replace(/^\/api(?=\/|$)/, '') || '/'
}
