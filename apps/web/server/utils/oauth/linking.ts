import type { Profile, ProviderName } from './providers'

/**
 * What a completed OAuth callback should do.
 *
 * Pure, and separate from every route, because this is where an account gets
 * taken over if it is wrong. Each decision below has a way of going badly that
 * is not obvious from the happy path, so each one is written down and tested
 * rather than inferred from the code.
 */

export interface ExistingIdentity {
  readonly userId: string
}

export interface Context {
  /** Set when the visitor is already signed in — they are linking, not logging in. */
  readonly currentUserId: string | null
  /** A linked identity already matching this provider account, if any. */
  readonly existingIdentity: ExistingIdentity | null
  /** A local account with the same verified address, if any. */
  readonly userIdWithSameEmail: string | null
}

export type Outcome =
  /** Sign this user in. Nothing to write. */
  | { readonly action: 'sign-in'; readonly userId: string }
  /** Attach this provider account to an existing user, then sign them in. */
  | { readonly action: 'link'; readonly userId: string }
  /** No local account matches: make one from the profile. */
  | { readonly action: 'create' }
  | { readonly action: 'refuse'; readonly reason: RefusalReason }

export type RefusalReason =
  | 'no-account-id'
  | 'email-not-verified'
  | 'already-linked-to-another-user'

export function decide(profile: Profile, context: Context): Outcome {
  if (!profile.providerAccountId) {
    return { action: 'refuse', reason: 'no-account-id' }
  }

  if (context.existingIdentity) {
    /*
     * This provider account is already attached to someone.
     *
     * If the visitor is signed in as somebody else, that is not a link — it is
     * one account trying to absorb another's sign-in method, which would leave
     * two people able to log in as one. Refuse and say so.
     */
    if (context.currentUserId && context.currentUserId !== context.existingIdentity.userId) {
      return { action: 'refuse', reason: 'already-linked-to-another-user' }
    }
    return { action: 'sign-in', userId: context.existingIdentity.userId }
  }

  // Signed in and this provider account is free: attach it to them. No email
  // check needed — they proved who they are with a session already.
  if (context.currentUserId) {
    return { action: 'link', userId: context.currentUserId }
  }

  /*
   * From here on the address is the only thing connecting the provider account
   * to a local one, so it has to be an address the provider vouches for.
   *
   * An unverified address is a claim, not a fact. Anyone can put someone
   * else's email on a fresh account at some providers, and matching on it
   * would hand them the local account that uses it.
   */
  if (!profile.email || !profile.emailVerified) {
    // Refused either way, and for two different reasons worth keeping straight.
    // With a local account on that address, matching would hand it over. With
    // none, there is still nothing to make an account from — every user here
    // has an address, and it is how password reset and every notification
    // reaches them.
    return { action: 'refuse', reason: 'email-not-verified' }
  }

  if (context.userIdWithSameEmail) {
    return { action: 'link', userId: context.userIdWithSameEmail }
  }

  return { action: 'create' }
}

/**
 * Whether a sign-in method may be removed.
 *
 * The rule that keeps people out of their own accounts: the last one cannot
 * go. Someone who signed up with GitHub and never set a password has exactly
 * one way in, and a tidy "disconnect" button would end their access to
 * everything they have done.
 */
export function mayUnlink(
  provider: ProviderName,
  linked: readonly ProviderName[],
  hasPassword: boolean
): { ok: true } | { ok: false; reason: 'not-linked' | 'last-method' } {
  if (!linked.includes(provider)) return { ok: false, reason: 'not-linked' }

  const remaining = linked.filter((name) => name !== provider).length + (hasPassword ? 1 : 0)
  return remaining > 0 ? { ok: true } : { ok: false, reason: 'last-method' }
}
