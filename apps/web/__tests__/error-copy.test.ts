import { describe, expect, it } from 'vitest'
import { ERROR_COPY, FALLBACK_COPY, copyForStatus } from '~/utils/error-copy'

/**
 * Every status the API's tagged errors can produce, plus the gateway's 402 and
 * the proxy-level 5xx family. If a new `HttpApiSchema.annotations({ status })`
 * appears in `apps/api/src/api/errors.ts`, it belongs here too.
 */
const HANDLED = [400, 401, 402, 403, 404, 409, 429, 500, 502, 503, 504]

describe('copyForStatus', () => {
  it('covers every status the app can actually return', () => {
    for (const status of HANDLED) {
      expect(ERROR_COPY[status], `missing copy for ${status}`).toBeDefined()
    }
  })

  it('returns the matching copy for a handled status', () => {
    expect(copyForStatus(404).eyebrow).toBe('not found')
    expect(copyForStatus(429).eyebrow).toBe('rate limited')
    expect(copyForStatus(402).eyebrow).toBe('budget reached')
  })

  it('accepts a numeric string, as Nuxt sometimes supplies', () => {
    expect(copyForStatus('503')).toBe(ERROR_COPY[503])
  })

  it('falls back rather than rendering an undefined page', () => {
    expect(copyForStatus(418)).toBe(FALLBACK_COPY)
    expect(copyForStatus(undefined)).toBe(FALLBACK_COPY)
    expect(copyForStatus('not-a-status')).toBe(FALLBACK_COPY)
  })

  it('always offers at least one way out', () => {
    for (const status of [...HANDLED, 418]) {
      const actions = copyForStatus(status).actions
      expect(actions.length, `no actions for ${status}`).toBeGreaterThan(0)
      for (const action of actions) {
        expect(action.label.length).toBeGreaterThan(0)
        // An action either navigates or reloads — never neither.
        expect(Boolean(action.to) || Boolean(action.reload)).toBe(true)
      }
    }
  })

  it('writes titles as statements, not apologies', () => {
    for (const status of HANDLED) {
      const { title, body } = copyForStatus(status)
      expect(title).not.toMatch(/sorry|oops|uh.?oh/i)
      expect(body).not.toMatch(/sorry|oops/i)
      expect(title.endsWith('.')).toBe(true)
    }
  })

  it('never leaves a status without an actionable body', () => {
    for (const status of HANDLED) {
      expect(copyForStatus(status).body.length).toBeGreaterThan(30)
    }
  })
})
