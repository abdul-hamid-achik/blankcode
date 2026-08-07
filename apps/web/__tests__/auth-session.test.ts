import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The session-survival rules, written down after the bug where every server
 * render of a signed-in page logged the user out: `fetchUser` used the API
 * client (relative `fetch`, impossible on the server), threw, and its
 * catch-all called `logout()` — which cleared both cookies in the SSR
 * response. Signing in and pressing F5 was a logout.
 */
describe('the session survives a refresh', () => {
  const store = readFileSync(join(process.cwd(), 'stores/auth.ts'), 'utf-8')
  const cookie = readFileSync(join(process.cwd(), 'utils/auth-cookie.ts'), 'utf-8')
  const oauth = readFileSync(join(process.cwd(), 'server/utils/oauth/session.ts'), 'utf-8')

  it('fetchUser never goes through the client that breaks on the server', () => {
    const body = store.slice(store.indexOf('async function fetchUser'))
    const fn = body.slice(0, body.indexOf('\n  }\n'))
    expect(fn).toContain('$fetch')
    expect(fn).not.toContain('useApi()')
  })

  it('fetchUser does not log out on a transient failure', () => {
    // A logout may only follow a definitive 4xx refusal — a network blip or
    // a 500 is a hiccup, not a revocation.
    const body = store.slice(store.indexOf('async function fetchUser'))
    expect(body).toContain('if (status !== 401) return')
    expect(body).toMatch(/status >= 400 && status < 500\) logout\(\)/)
  })

  it('auth cookies outlive the browser session', () => {
    // Without maxAge these were session cookies, and the thirty-day refresh
    // token inside evaporated with the window.
    expect(cookie).toContain('maxAge')
  })

  it('OAuth sessions default to the same lifetime as password sessions', () => {
    // '15m' here against the API's '7d' meant OAuth users expired within
    // minutes of signing in.
    expect(oauth).toContain("process.env['JWT_EXPIRES_IN'] ?? '7d'")
    expect(oauth).not.toContain("?? '15m'")
  })
})
