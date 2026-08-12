import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AI_TIERS, DEFAULT_TIER, resolveAiModel } from '~/server/utils/ai-model'

/**
 * `resolveAiModel` is where a stored preference meets entitlement — the one
 * place that decides whether "advanced" actually means advanced. Wrong here
 * either bills a free account for the strong model or silently downgrades a
 * paying one, so both directions of the fallback get their own case.
 */
describe('resolveAiModel', () => {
  it('falls an unpaid advanced tier back to standard', () => {
    expect(resolveAiModel('advanced', false)).toBe(AI_TIERS['standard'].gatewayModel)
  })

  it('gives a paid advanced tier what it stored', () => {
    expect(resolveAiModel('advanced', true)).toBe(AI_TIERS['advanced'].gatewayModel)
  })

  it('falls an unrecognised tier back to the default, paid or not', () => {
    expect(resolveAiModel('not-a-real-tier', false)).toBe(AI_TIERS[DEFAULT_TIER].gatewayModel)
    expect(resolveAiModel('not-a-real-tier', true)).toBe(AI_TIERS[DEFAULT_TIER].gatewayModel)
  })

  it('falls a missing tier back to the default', () => {
    expect(resolveAiModel(null, false)).toBe(AI_TIERS[DEFAULT_TIER].gatewayModel)
    expect(resolveAiModel(undefined, false)).toBe(AI_TIERS[DEFAULT_TIER].gatewayModel)
  })
})

/**
 * Source-level, like the explain endpoint's own tests: the property that
 * matters is that the route never writes an arbitrary string to
 * `users.ai_model`, and a mocked-db behaviour test would not catch a
 * validator that got quietly deleted.
 */
describe('the ai-model POST route', () => {
  const source = readFileSync(
    join(process.cwd(), 'server/routes/api/account/ai-model.post.ts'),
    'utf-8'
  )

  it('validates the tier with isAiTier before storing it', () => {
    expect(source).toContain('isAiTier(body?.tier)')
  })

  it('stores on users.aiModel', () => {
    expect(source).toContain('aiModel: body.tier')
  })
})
