import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * GET /api/account/harness-sessions is the answer to "where do I see agent
 * activity" on /connect: the caller's own last 10 practice sittings, plus
 * totals across all of them. Source-level because the route needs Nuxt's
 * H3 auto-imports (`defineEventHandler`, `createError`) that plain Vitest
 * does not provide — see AGENTS.md on testing server routes.
 */

const ROUTE = join(process.cwd(), 'server/routes/api/account/harness-sessions.get.ts')
const source = readFileSync(ROUTE, 'utf-8')

describe('the harness-sessions endpoint', () => {
  it('is session-authed, like the other account routes', () => {
    expect(source).toContain('requireUserId')
  })

  it('scopes every query to the caller', () => {
    // Two queries read this table; both must filter by the caller's id, or
    // one person's agent activity leaks into another's dashboard.
    const matches = source.match(/eq\(harnessSessions\.userId, userId\)/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(2)
  })

  it('orders the most recent sitting first', () => {
    expect(source).toContain('desc(harnessSessions.lastSeenAt)')
  })

  it('caps the list at 10 sessions', () => {
    expect(source).toContain('.limit(10)')
  })

  it('returns the fields the ledger needs, nothing about the token itself', () => {
    expect(source).toContain('clientName')
    expect(source).toContain('clientVersion')
    expect(source).toContain('toolCalls')
    expect(source).toContain('startedAt')
    expect(source).toContain('lastSeenAt')
    expect(source).not.toContain('apiTokenId')
  })

  it('computes totals across every session, not just the returned page', () => {
    expect(source).toContain('count()')
    expect(source).toContain('sum(harnessSessions.toolCalls)')
    expect(source).toMatch(/totals:\s*{/)
  })
})
