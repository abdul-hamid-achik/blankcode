import { randomBytes } from 'node:crypto'
import { credentialsFor, isProviderName, PROVIDERS } from '../../../../utils/oauth/providers'
import { AUTH_COOKIE_OPTIONS } from '~/utils/auth-cookie'

/**
 * Sends someone to the provider.
 *
 * The `state` is a random value stored in a short-lived cookie and checked on
 * the way back. Without it, a third party can hand a victim a callback URL
 * carrying their own authorization code and silently attach their provider
 * account to the victim's session — the login version of CSRF.
 */
export default defineEventHandler((event) => {
  const name = getRouterParam(event, 'provider') ?? ''
  if (!isProviderName(name)) {
    throw createError({ statusCode: 404, statusMessage: 'Unknown provider' })
  }

  const credentials = credentialsFor(name)
  if (!credentials) {
    throw createError({ statusCode: 503, statusMessage: `${name} sign-in is not configured` })
  }

  const provider = PROVIDERS[name]
  const state = randomBytes(32).toString('base64url')

  setCookie(event, `oauth-state-${name}`, state, {
    ...AUTH_COOKIE_OPTIONS,
    httpOnly: true,
    // Ten minutes: long enough to sign in, short enough that a stale value
    // cannot be replayed later.
    maxAge: 600,
  })

  const site = (useRuntimeConfig().public['siteUrl'] as string).replace(/\/+$/, '')
  const url = new URL(provider.authorizeUrl)
  url.searchParams.set('client_id', credentials.clientId)
  url.searchParams.set('redirect_uri', `${site}/api/oauth/${name}/callback`)
  url.searchParams.set('scope', provider.scope)
  url.searchParams.set('state', state)
  url.searchParams.set('response_type', 'code')

  return sendRedirect(event, url.toString(), 302)
})
