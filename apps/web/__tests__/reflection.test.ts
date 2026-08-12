import { describe, expect, it } from 'vitest'
import {
  defaultReflectQuestion,
  isSubstantiveReflection,
  MIN_SUBSTANTIVE_REFLECTION_CHARS,
} from '~/utils/reflection'

describe('isSubstantiveReflection', () => {
  it('rejects the hollow answers the floor exists for', () => {
    for (const hollow of ['yes', 'makes sense', 'the tests pass', 'idk', '   ok   ']) {
      expect(isSubstantiveReflection(hollow)).toBe(false)
    }
  })

  it('accepts a real explanation at the floor', () => {
    expect(
      isSubstantiveReflection(
        'The blank is the type parameter — without it the identity function is not generic.'
      )
    ).toBe(true)
  })

  it('trims before measuring, so padding alone is hollow', () => {
    expect(isSubstantiveReflection(' '.repeat(MIN_SUBSTANTIVE_REFLECTION_CHARS + 10))).toBe(false)
  })
})

describe('defaultReflectQuestion', () => {
  it('matches the MCP catalogue for known types', () => {
    expect(defaultReflectQuestion('review')).toContain('defect')
    expect(defaultReflectQuestion('challenge')).toContain('key decision')
    expect(defaultReflectQuestion('context')).toContain('noise')
  })

  it('falls back to the challenge question for unknown types', () => {
    expect(defaultReflectQuestion(undefined)).toBe(defaultReflectQuestion('challenge'))
    expect(defaultReflectQuestion('not-a-type')).toBe(defaultReflectQuestion('challenge'))
  })
})
