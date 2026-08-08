import { randomBytes } from 'node:crypto'
import { hashPracticeToken, isPracticeToken, PRACTICE_TOKEN_PREFIX } from '@blankcode/shared'

/**
 * Minting and recognising practice tokens — the credential a coding agent
 * carries into the API.
 *
 * Format: `bck_` + 43 chars of base64url (256 random bits). The prefix makes
 * a leaked token findable: secret scanners and a worried `grep -r bck_`
 * both work, which is the whole argument for prefixed tokens over bare hex.
 *
 * The secret is never stored. The database keeps sha256(token) for lookup
 * (the token is high-entropy, so sha256 alone is sound — bcrypt here would
 * tax every tool call for nothing) and the first 12 characters for display,
 * so a person can tell their keys apart in Settings without any key being
 * shown twice.
 */

export { PRACTICE_TOKEN_PREFIX, isPracticeToken, hashPracticeToken }

export interface MintedToken {
  /** The full secret. Shown once, then only its hash survives. */
  token: string
  /** sha256 hex of the full secret — the DB lookup key. */
  lookupHash: string
  /** First 12 characters, for recognising the token in a list. */
  displayPrefix: string
}

export async function mintPracticeToken(): Promise<MintedToken> {
  const token = `${PRACTICE_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`
  return {
    token,
    lookupHash: await hashPracticeToken(token),
    displayPrefix: token.slice(0, 12),
  }
}
