import { describe, expect, it } from 'vitest'
import { EXERCISE_TYPES } from '@blankcode/shared'
import { exerciseTypeBadge } from '../utils/exercise-type-badge'

describe('exerciseTypeBadge', () => {
  it('covers every authored exercise type, including agent', () => {
    for (const type of EXERCISE_TYPES) {
      const badge = exerciseTypeBadge(type)
      expect(badge.label.length).toBeGreaterThan(0)
      expect(badge.label).not.toMatch(/📝|🏆|🔎|✉️|🧾/)
    }
    expect(exerciseTypeBadge('agent').label).toBe('supervise')
  })

  it('falls back to blank when the type is missing', () => {
    expect(exerciseTypeBadge(undefined).label).toBe('blank')
  })
})
