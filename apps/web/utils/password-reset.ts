/**
 * Password-reset JWT claims. Signing lives next to the route; this is the
 * shape the verifier must accept and nothing else — a session token must
 * not reset a password.
 */

export const RESET_PURPOSE = 'password-reset'
export const RESET_MINUTES = 30

export interface ResetClaims {
  sub: string
  email: string
  purpose: typeof RESET_PURPOSE
}

export function isResetClaims(payload: unknown): payload is ResetClaims {
  if (!payload || typeof payload !== 'object') return false
  const row = payload as Record<string, unknown>
  return (
    typeof row['sub'] === 'string' &&
    row['sub'].length > 0 &&
    typeof row['email'] === 'string' &&
    row['email'].includes('@') &&
    row['purpose'] === RESET_PURPOSE
  )
}
