/**
 * What each provider needs, as data.
 *
 * The two flows differ only in URLs, scopes and the shape of the profile they
 * return, so the difference lives here and the route is written once. Adding a
 * third provider should be an entry in this file, not another callback.
 */

export type ProviderName = 'github' | 'google'

export interface Provider {
  readonly authorizeUrl: string
  readonly tokenUrl: string
  /** Only what is needed. Anything more triggers review and buys nothing. */
  readonly scope: string
  readonly clientIdEnv: string
  readonly clientSecretEnv: string
}

export const PROVIDERS: Record<ProviderName, Provider> = {
  github: {
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    // `user:email` because a GitHub profile can hide the address, and without
    // it anyone with a private email could not link an account at all.
    scope: 'read:user user:email',
    clientIdEnv: 'GITHUB_CLIENT_ID',
    clientSecretEnv: 'GITHUB_CLIENT_SECRET',
  },
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
  },
}

export function isProviderName(value: string): value is ProviderName {
  return value === 'github' || value === 'google'
}

/** Whether this provider is configured at all. */
export function credentialsFor(
  name: ProviderName
): { clientId: string; clientSecret: string } | null {
  const provider = PROVIDERS[name]
  const clientId = process.env[provider.clientIdEnv]
  const clientSecret = process.env[provider.clientSecretEnv]
  return clientId && clientSecret ? { clientId, clientSecret } : null
}

/**
 * A profile, reduced to the only three things that matter.
 *
 * `emailVerified` is not decoration. It decides whether an account with this
 * address may be taken over, so a provider that does not say yes is treated as
 * having said no.
 */
export interface Profile {
  readonly providerAccountId: string
  readonly email: string | null
  readonly emailVerified: boolean
  readonly name: string | null
}

export function parseGithubUser(
  user: Record<string, unknown>,
  emails: Array<Record<string, unknown>>
): Profile {
  /*
   * The address comes from /user/emails, not from the profile.
   *
   * `user.email` is null for anyone who kept it private, and it is not
   * guaranteed verified. The emails endpoint says which is primary and which
   * is verified, and only an address that is both can be trusted to identify a
   * person.
   */
  const chosen = emails.find((entry) => entry['primary'] === true && entry['verified'] === true)

  return {
    providerAccountId: String(user['id'] ?? ''),
    email: chosen ? String(chosen['email']) : null,
    emailVerified: Boolean(chosen),
    name: (user['name'] as string | null) ?? (user['login'] as string | null) ?? null,
  }
}

export function parseGoogleUser(user: Record<string, unknown>): Profile {
  return {
    providerAccountId: String(user['sub'] ?? ''),
    email: (user['email'] as string | null) ?? null,
    // Google sends this as a boolean or the string "true" depending on the
    // endpoint. Anything else is not a yes.
    emailVerified: user['email_verified'] === true || user['email_verified'] === 'true',
    name: (user['name'] as string | null) ?? null,
  }
}
