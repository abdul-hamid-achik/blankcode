import { describe, expect, it } from 'vitest'
import { type Context, decide, mayUnlink } from '~/server/utils/oauth/linking'
import { parseGithubUser, parseGoogleUser, type Profile } from '~/server/utils/oauth/providers'

const profile = (over: Partial<Profile> = {}): Profile => ({
  providerAccountId: '12345',
  email: 'someone@example.com',
  emailVerified: true,
  name: 'Someone',
  ...over,
})

const context = (over: Partial<Context> = {}): Context => ({
  currentUserId: null,
  existingIdentity: null,
  userIdWithSameEmail: null,
  ...over,
})

describe('decide', () => {
  it('signs in a provider account that is already linked', () => {
    const outcome = decide(profile(), context({ existingIdentity: { userId: 'u1' } }))
    expect(outcome).toEqual({ action: 'sign-in', userId: 'u1' })
  })

  it('links a free provider account to whoever is signed in', () => {
    // No email check needed here: a session already proves who they are.
    const outcome = decide(profile({ emailVerified: false }), context({ currentUserId: 'u1' }))
    expect(outcome).toEqual({ action: 'link', userId: 'u1' })
  })

  it('refuses to move a provider account between local accounts', () => {
    // One account absorbing another's sign-in method would leave two people
    // able to log in as one.
    const outcome = decide(
      profile(),
      context({ currentUserId: 'u2', existingIdentity: { userId: 'u1' } })
    )
    expect(outcome).toEqual({ action: 'refuse', reason: 'already-linked-to-another-user' })
  })

  it('is a no-op when someone re-links the account they already linked', () => {
    const outcome = decide(
      profile(),
      context({ currentUserId: 'u1', existingIdentity: { userId: 'u1' } })
    )
    expect(outcome).toEqual({ action: 'sign-in', userId: 'u1' })
  })

  it('links a verified address to the local account that uses it', () => {
    const outcome = decide(profile(), context({ userIdWithSameEmail: 'u9' }))
    expect(outcome).toEqual({ action: 'link', userId: 'u9' })
  })

  it('refuses an unverified address that matches a local account', () => {
    // The takeover this whole module exists to prevent: an unverified address
    // is a claim, and matching on it hands over the account that uses it.
    const outcome = decide(
      profile({ emailVerified: false }),
      context({ userIdWithSameEmail: 'u9' })
    )
    expect(outcome).toEqual({ action: 'refuse', reason: 'email-not-verified' })
  })

  it('refuses an unverified address even with nothing to take over', () => {
    // Not a takeover, but there is still nothing to build an account from:
    // every user here has an address, and it is how a reset reaches them.
    expect(decide(profile({ emailVerified: false }), context())).toEqual({
      action: 'refuse',
      reason: 'email-not-verified',
    })
  })

  it('refuses a profile with no account id', () => {
    expect(decide(profile({ providerAccountId: '' }), context())).toEqual({
      action: 'refuse',
      reason: 'no-account-id',
    })
  })

  it('creates an account when a verified address matches nothing', () => {
    expect(decide(profile(), context())).toEqual({ action: 'create' })
  })
})

describe('mayUnlink', () => {
  it('allows removing one of two providers', () => {
    expect(mayUnlink('github', ['github', 'google'], false)).toEqual({ ok: true })
  })

  it('allows removing the only provider when a password exists', () => {
    expect(mayUnlink('github', ['github'], true)).toEqual({ ok: true })
  })

  it('refuses to remove the last way in', () => {
    // Someone who signed up with GitHub and never set a password has exactly
    // one way in. A tidy "disconnect" button would end their access to
    // everything they have done.
    expect(mayUnlink('github', ['github'], false)).toEqual({ ok: false, reason: 'last-method' })
  })

  it('refuses to remove something that is not linked', () => {
    expect(mayUnlink('google', ['github'], true)).toEqual({ ok: false, reason: 'not-linked' })
  })
})

describe('parseGithubUser', () => {
  it('takes the address that is both primary and verified', () => {
    const result = parseGithubUser({ id: 7, login: 'someone' }, [
      { email: 'old@example.com', primary: false, verified: true },
      { email: 'real@example.com', primary: true, verified: true },
    ])
    expect(result.email).toBe('real@example.com')
    expect(result.emailVerified).toBe(true)
  })

  it('reports no verified address when the primary one is unverified', () => {
    // Primary alone is not enough. An unverified primary is an address someone
    // typed, not one they proved they own.
    const result = parseGithubUser({ id: 7 }, [
      { email: 'claimed@example.com', primary: true, verified: false },
    ])
    expect(result.email).toBeNull()
    expect(result.emailVerified).toBe(false)
  })

  it('handles a profile with a hidden address', () => {
    // `user.email` is null for anyone who kept it private, which is why the
    // emails endpoint is fetched at all.
    const result = parseGithubUser({ id: 7, email: null, login: 'ghost' }, [
      { email: 'hidden@example.com', primary: true, verified: true },
    ])
    expect(result.email).toBe('hidden@example.com')
    expect(result.name).toBe('ghost')
  })

  it('uses the numeric id, not the login, as the account id', () => {
    // A login can be changed and reused by someone else. The id cannot.
    expect(parseGithubUser({ id: 7, login: 'someone' }, []).providerAccountId).toBe('7')
  })
})

describe('parseGoogleUser', () => {
  it('accepts a boolean verified flag', () => {
    const result = parseGoogleUser({ sub: 'abc', email: 'a@b.c', email_verified: true })
    expect(result.emailVerified).toBe(true)
  })

  it('accepts the string form Google sometimes sends', () => {
    const result = parseGoogleUser({ sub: 'abc', email: 'a@b.c', email_verified: 'true' })
    expect(result.emailVerified).toBe(true)
  })

  it('treats anything else as unverified', () => {
    for (const value of [false, 'false', undefined, null, 1, 'yes']) {
      const result = parseGoogleUser({ sub: 'abc', email: 'a@b.c', email_verified: value })
      expect(result.emailVerified).toBe(false)
    }
  })

  it('uses sub as the account id', () => {
    // Not the email: people change it, and the account is still theirs.
    expect(parseGoogleUser({ sub: '1088', email: 'a@b.c' }).providerAccountId).toBe('1088')
  })
})
