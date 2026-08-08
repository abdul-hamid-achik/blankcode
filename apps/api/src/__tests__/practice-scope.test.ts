import { describe, expect, it } from 'vitest'
import { apiPathOf, practiceScopeAllows } from '../middleware/practice-scope.js'

/**
 * The scope is the security boundary of the whole bring-your-own-agent
 * feature: a leaked practice token must mean "someone can practice as you",
 * never "someone can bill, reconfigure, or impersonate you". These tests are
 * the sentence-by-sentence reading of that promise.
 */

describe('practiceScopeAllows', () => {
  it.each([
    ['GET', '/tracks'],
    ['GET', '/tracks/typescript'],
    ['GET', '/exercises'],
    ['GET', '/exercises/abc-123'],
    ['GET', '/paths'],
    ['GET', '/progress/summary'],
    ['GET', '/progress/completed'],
    ['GET', '/reviews/due'],
    ['GET', '/reviews/due/count'],
    ['GET', '/reviews/upcoming'],
    ['GET', '/auth/me'],
    ['POST', '/submissions'],
    ['POST', '/submissions/run'],
    ['GET', '/submissions/abc-123'],
  ])('allows the practice loop: %s %s', (method, path) => {
    expect(practiceScopeAllows(method, path)).toBe(true)
  })

  it.each([
    // The recall rating is the human's self-report about the human's memory.
    ['POST', '/reviews/abc-123/complete'],
    // A token that can mint sessions is not a practice token.
    ['POST', '/auth/login'],
    ['POST', '/auth/refresh'],
    ['POST', '/auth/register'],
    ['GET', '/users/someone'],
    ['POST', '/exercises'],
    // Unknown routes are refused by default — allowlist, not blocklist.
    ['GET', '/achievements'],
    ['POST', '/anything/new'],
    // `/submissions/run` is exact: nothing rides in on its prefix.
    ['POST', '/submissions/run/extra'],
  ])('refuses everything else: %s %s', (method, path) => {
    expect(practiceScopeAllows(method, path)).toBe(false)
  })

  it('does not let a trailing slash smuggle a path past a rule', () => {
    expect(practiceScopeAllows('POST', '/reviews/x/complete/')).toBe(false)
    expect(practiceScopeAllows('GET', '/tracks/')).toBe(true)
  })
})

describe('apiPathOf', () => {
  it('strips the mount prefix and the query', () => {
    expect(apiPathOf('/api/exercises?limit=5')).toBe('/exercises')
    expect(apiPathOf('/exercises')).toBe('/exercises')
    expect(apiPathOf('/api')).toBe('/')
  })

  it('does not strip a prefix that merely starts with api', () => {
    expect(apiPathOf('/apiary/hives')).toBe('/apiary/hives')
  })
})
