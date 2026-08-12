import { describe, expect, it } from 'vitest'
import {
  isHollowReflection,
  isSubstantiveReflection,
  MIN_SUBSTANTIVE_REFLECTION_CHARS,
} from '../reflection'

describe('isSubstantiveReflection', () => {
  it('rejects the hollow answers the floor exists for', () => {
    for (const hollow of ['yes', 'makes sense', 'the tests pass', 'idk', '   ok   ']) {
      expect(isSubstantiveReflection(hollow)).toBe(false)
      expect(isHollowReflection(hollow)).toBe(true)
    }
  })

  it('accepts a real explanation at the floor', () => {
    const answer =
      'The blank is the type parameter — without it the identity function is not generic.'
    expect(isSubstantiveReflection(answer)).toBe(true)
    expect(isHollowReflection(answer)).toBe(false)
  })

  it('trims before measuring, so padding alone is hollow', () => {
    expect(isSubstantiveReflection(' '.repeat(MIN_SUBSTANTIVE_REFLECTION_CHARS + 10))).toBe(false)
  })
})
