/**
 * The practice-token format, in the one place both sides import.
 *
 * The web app mints and looks up tokens; the Effect API's auth middleware
 * recognises and hashes them. Two hand-copies of the prefix and the hash
 * were drift-in-waiting — change either and tokens keep working on one door
 * while 401ing on the other. Web Crypto rather than node:crypto because this
 * package also ships to the browser: same primitive, every runtime.
 */

/** Prefixed so a leaked token is findable by a grep and by secret scanners. */
export const PRACTICE_TOKEN_PREFIX = 'bck_'

export function isPracticeToken(bearer: string): boolean {
  return bearer.startsWith(PRACTICE_TOKEN_PREFIX)
}

/** The DB lookup key: sha256 hex of the full secret. */
export async function hashPracticeToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
