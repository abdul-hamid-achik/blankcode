import { randomBytes } from 'node:crypto'
import { createDatabaseFromEnv } from '@blankcode/db/client'
import { linkedIdentities, users } from '@blankcode/db/schema'
import { and, eq } from 'drizzle-orm'
import * as jose from 'jose'
import { decide } from '~/server/utils/oauth/linking'
import {
  credentialsFor,
  isProviderName,
  parseGithubUser,
  parseGoogleUser,
  type Profile,
  PROVIDERS,
} from '~/server/utils/oauth/providers'
import { issueSession } from '~/server/utils/oauth/session'
import { safeInternalRedirect } from '~/utils/auth-redirect'
import { AUTH_COOKIE_OPTIONS } from '~/utils/auth-cookie'

/**
 * The way back from the provider.
 *
 * Every decision with consequences lives in `decide()` and is unit-tested;
 * this route is the plumbing around it: state check, code exchange, profile
 * fetch, then act on the outcome. Errors redirect to /login with a reason
 * rather than rendering JSON — the person on this URL is mid-login in a
 * browser, not a client parsing responses.
 */

function bounce(event: Parameters<typeof sendRedirect>[0], reason: string) {
  return sendRedirect(event, `/login?error=${encodeURIComponent(reason)}`, 302)
}

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'provider') ?? ''
  if (!isProviderName(name)) {
    throw createError({ statusCode: 404, statusMessage: 'Unknown provider' })
  }

  const credentials = credentialsFor(name)
  if (!credentials) return bounce(event, 'oauth-not-configured')

  const query = getQuery(event)
  const code = typeof query['code'] === 'string' ? query['code'] : null
  const state = typeof query['state'] === 'string' ? query['state'] : null

  /*
   * The state cookie proves this callback belongs to a flow *this browser*
   * started. Compared before anything else is believed: a mismatch means the
   * URL was handed to the victim by someone else, and acting on its code would
   * attach the attacker's provider account to the victim's session.
   */
  const expected = getCookie(event, `oauth-state-${name}`)
  deleteCookie(event, `oauth-state-${name}`)
  if (!code || !state || !expected || state !== expected) {
    return bounce(event, 'oauth-state-mismatch')
  }

  const provider = PROVIDERS[name]
  const site = (useRuntimeConfig().public['siteUrl'] as string).replace(/\/+$/, '')

  // The PKCE verifier set at start, for the provider that supports it.
  const verifier = name === 'google' ? getCookie(event, 'oauth-verifier-google') : undefined
  if (name === 'google') deleteCookie(event, 'oauth-verifier-google')

  // Exchange the one-time code for an access token.
  let accessToken: string
  try {
    const response = await $fetch<Record<string, unknown>>(provider.tokenUrl, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: {
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        code,
        redirect_uri: `${site}/api/oauth/${name}/callback`,
        grant_type: 'authorization_code',
        ...(verifier ? { code_verifier: verifier } : {}),
      },
    })
    const token = response['access_token']
    if (typeof token !== 'string' || !token) throw new Error('no access_token')
    accessToken = token
  } catch (error) {
    console.error(`[oauth] ${name} code exchange failed:`, String(error))
    return bounce(event, 'oauth-exchange-failed')
  }

  // Fetch the profile, reduced to the three fields that matter.
  let profile: Profile
  try {
    if (name === 'github') {
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'blankcode.dev',
      }
      const [user, emails] = await Promise.all([
        $fetch<Record<string, unknown>>('https://api.github.com/user', { headers }),
        $fetch<Array<Record<string, unknown>>>('https://api.github.com/user/emails', {
          headers,
        }).catch(() => []),
      ])
      profile = parseGithubUser(user, emails)
    } else {
      const user = await $fetch<Record<string, unknown>>(
        'https://openidconnect.googleapis.com/v1/userinfo',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      profile = parseGoogleUser(user)
    }
  } catch (error) {
    console.error(`[oauth] ${name} profile fetch failed:`, String(error))
    return bounce(event, 'oauth-profile-failed')
  }

  const db = createDatabaseFromEnv()

  // Who is already signed in, if anyone — they are linking, not logging in.
  let currentUserId: string | null = null
  const sessionToken = getCookie(event, 'token')
  if (sessionToken && process.env['JWT_SECRET']) {
    try {
      const verified = await jose.jwtVerify(
        sessionToken,
        new TextEncoder().encode(process.env['JWT_SECRET'])
      )
      currentUserId = verified.payload.sub ?? null
    } catch {
      // An expired session on a login URL is ordinary, not an error.
    }
  }

  const existing = await db.query.linkedIdentities.findFirst({
    where: and(
      eq(linkedIdentities.provider, name),
      eq(linkedIdentities.providerAccountId, profile.providerAccountId)
    ),
    columns: { userId: true },
  })

  const sameEmail =
    profile.email && profile.emailVerified
      ? await db.query.users.findFirst({
          where: eq(users.email, profile.email),
          columns: { id: true },
        })
      : null

  const outcome = decide(profile, {
    currentUserId,
    existingIdentity: existing ?? null,
    userIdWithSameEmail: sameEmail?.id ?? null,
  })

  let userId: string
  switch (outcome.action) {
    case 'refuse':
      return bounce(event, `oauth-${outcome.reason}`)

    case 'sign-in':
      userId = outcome.userId
      break

    case 'link': {
      userId = outcome.userId
      await db
        .insert(linkedIdentities)
        .values({
          userId,
          provider: name,
          providerAccountId: profile.providerAccountId,
          email: profile.email,
        })
        // A concurrent second callback for the same account is a retry, not a
        // conflict worth failing the login over.
        .onConflictDoNothing()
      break
    }

    case 'create': {
      // decide() only reaches here with a verified address.
      const email = profile.email as string
      const username = await freeUsername(db, email)
      const [created] = await db
        .insert(users)
        .values({
          email,
          username,
          displayName: profile.name,
          // Unusable on purpose: not a bcrypt hash, so no password compare
          // can ever succeed, and random so it is not a known constant either.
          // This account signs in with the provider; a password can be set
          // through reset once that flow exists.
          passwordHash: `oauth:${randomBytes(32).toString('hex')}`,
        })
        .returning({ id: users.id })
      if (!created) return bounce(event, 'oauth-create-failed')
      userId = created.id
      await db.insert(linkedIdentities).values({
        userId,
        provider: name,
        providerAccountId: profile.providerAccountId,
        email,
      })
      break
    }
  }

  const emailForToken =
    profile.email ??
    (await db.query.users.findFirst({ where: eq(users.id, userId), columns: { email: true } }))
      ?.email ??
    ''

  const session = await issueSession(userId, emailForToken)

  setCookie(event, 'token', session.accessToken, AUTH_COOKIE_OPTIONS)
  setCookie(event, 'refresh-token', session.refreshToken, AUTH_COOKIE_OPTIONS)

  // Linking came from settings. A fresh sign-in returns to the page they
  // were bounced from, when the start route stored one.
  const storedNext = getCookie(event, 'oauth-next')
  deleteCookie(event, 'oauth-next')
  const next = currentUserId
    ? '/settings?linked=' + name
    : safeInternalRedirect(storedNext, '/dashboard')
  return sendRedirect(event, next, 302)
})

/**
 * A username that is not taken.
 *
 * Derived from the address's local part, cleaned to the schema's pattern, with
 * a numeric suffix on collision. Bounded: after a handful of tries it falls
 * back to a random suffix rather than looping on a popular name forever.
 */
async function freeUsername(
  db: ReturnType<typeof createDatabaseFromEnv>,
  email: string
): Promise<string> {
  const base =
    (email.split('@')[0] ?? 'user')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24) || 'user'

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt}`
    const taken = await db.query.users.findFirst({
      where: eq(users.username, candidate),
      columns: { id: true },
    })
    if (!taken) return candidate
  }
  return `${base}-${Math.random().toString(36).slice(2, 8)}`
}
