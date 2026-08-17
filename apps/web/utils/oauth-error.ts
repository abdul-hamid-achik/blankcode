/**
 * OAuth callback failures land on `/login?error=…`. The form has to say
 * what happened — a clean form after a failed GitHub bounce looks like
 * nothing happened.
 */

const MESSAGES: Record<string, string> = {
  'oauth-not-configured': 'That sign-in method is not available right now.',
  'oauth-state-mismatch': 'The sign-in attempt expired. Try again.',
  'oauth-exchange-failed': 'The provider did not complete sign-in. Try again.',
  'oauth-profile-failed': 'The provider did not return a profile. Try again.',
  'oauth-create-failed': 'Could not create the account. Try again.',
  'oauth-no-account-id': 'The provider did not identify the account. Try email instead.',
  'oauth-email-not-verified':
    'That provider has not verified the email on the account. Verify it there, or use email.',
  'oauth-already-linked-to-another-user':
    'That provider account is already linked to a different BlankCode account.',
}

export function oauthErrorMessage(code: unknown): string | null {
  if (typeof code !== 'string' || code.length === 0) return null
  return MESSAGES[code] ?? 'Sign-in with that provider failed. Try again, or use email.'
}
