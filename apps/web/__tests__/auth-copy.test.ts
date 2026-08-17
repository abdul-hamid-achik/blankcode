import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LOGIN_BLURB, LOGIN_HEADING, REGISTER_BLURB, REGISTER_HEADING } from '../utils/auth-copy'
import { destinationHint, safeInternalRedirect } from '../utils/auth-redirect'
import { oauthErrorMessage } from '../utils/oauth-error'

const web = process.cwd()

describe('hosted auth copy', () => {
  it('does not claim the account is local or that nothing leaves the machine', () => {
    expect(REGISTER_HEADING).toBe('Create an account.')
    expect(REGISTER_BLURB).not.toMatch(/nothing leaves this machine/i)
    expect(REGISTER_BLURB).not.toMatch(/no server but yours/i)
    expect(LOGIN_BLURB).not.toMatch(/your own database/i)
    expect(LOGIN_HEADING).toBe('Back to it.')
  })

  it('is what the pages render', () => {
    const register = readFileSync(join(web, 'pages/register.vue'), 'utf-8')
    const login = readFileSync(join(web, 'pages/login.vue'), 'utf-8')
    expect(register).toContain('REGISTER_HEADING')
    expect(register).toContain('REGISTER_BLURB')
    expect(register).not.toContain('Create a local account.')
    expect(login).toContain('LOGIN_HEADING')
    expect(login).toContain('LOGIN_BLURB')
    expect(login).not.toContain('your own database')
  })
})

describe('safeInternalRedirect', () => {
  it('accepts a same-origin path and rejects protocol-relative URLs', () => {
    expect(safeInternalRedirect('/exercise/abc')).toBe('/exercise/abc')
    expect(safeInternalRedirect('//evil.test')).toBe('/dashboard')
    expect(safeInternalRedirect('https://evil.test')).toBe('/dashboard')
    expect(safeInternalRedirect(undefined)).toBe('/dashboard')
  })

  it('lets register use a caller-supplied fallback', () => {
    expect(safeInternalRedirect(undefined, '/tracks')).toBe('/tracks')
    expect(safeInternalRedirect('/reading/click-counter', '/tracks')).toBe('/reading/click-counter')
  })
})

describe('destinationHint', () => {
  it('names the mid-task surfaces a guest is bounced from', () => {
    expect(destinationHint('/exercise/87bd9808-bf2e-417f-9232-8cf3825f9e32')).toBe(
      'the exercise you picked'
    )
    expect(destinationHint('/reading/click-counter')).toBe('that reading')
    expect(destinationHint('/connect')).toBe('connect your agent')
    expect(destinationHint('/dashboard')).toBeNull()
  })
})

describe('oauthErrorMessage', () => {
  it('maps the bounce codes the callback actually writes', () => {
    expect(oauthErrorMessage('oauth-state-mismatch')).toMatch(/expired/i)
    expect(oauthErrorMessage('oauth-already-linked-to-another-user')).toMatch(/already linked/i)
    expect(oauthErrorMessage('oauth-made-up')).toMatch(/Try again/)
    expect(oauthErrorMessage(undefined)).toBeNull()
  })
})
