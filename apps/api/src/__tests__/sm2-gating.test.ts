import { describe, expect, it } from 'vitest'
import {
  calculateNextReview,
  holdForReflection,
  isSubstantiveReflection,
  MIN_SUBSTANTIVE_REFLECTION_CHARS,
} from '../modules/reviews/scheduler.js'
import { shouldScheduleReview } from '../modules/submissions/run-submission.js'

/**
 * The owner's decision, verbatim: agent passes do not move the memory
 * schedule. SM-2 models the human's recall; a schedule advanced by an
 * agent's recall is a corrupted model wearing good numbers. The vibecoding
 * forms are the flip side — working through an agent is their curriculum.
 */
describe('shouldScheduleReview', () => {
  it('the web session always moves the schedule', () => {
    for (const type of ['blank', 'challenge', 'review', 'turn', 'context', undefined]) {
      expect(shouldScheduleReview('web', type)).toBe(true)
    }
  })

  it('an agent moves it for every form except recall', () => {
    expect(shouldScheduleReview('agent', 'challenge')).toBe(true)
    expect(shouldScheduleReview('agent', 'review')).toBe(true)
    expect(shouldScheduleReview('agent', 'turn')).toBe(true)
    expect(shouldScheduleReview('agent', 'context')).toBe(true)
  })

  it('an agent filling blanks leaves the review owed', () => {
    expect(shouldScheduleReview('agent', 'blank')).toBe(false)
  })
})

/**
 * The second half of the same decision: the forms an agent MAY move still
 * are not believed until the human explains the pass. The SM-2 state
 * advances; the date does not — it parks in heldNextReviewAt with the
 * review capped a day out.
 */
describe('holdForReflection', () => {
  it('caps a multi-day interval at one day and parks the earned date', () => {
    const now = new Date('2026-08-08T12:00:00Z')
    // Third rep: 3 days * ease — comfortably past the cap.
    const result = calculateNextReview(4, 3, 2, 2.5)
    const held = holdForReflection(result, now)

    expect(held.heldNextReviewAt).toEqual(result.nextReviewAt)
    expect(held.nextReviewAt.getTime()).toBe(new Date('2026-08-09T12:00:00Z').getTime())
    expect(held.nextReviewAt.getTime()).toBeLessThan(result.nextReviewAt.getTime())
  })

  it('leaves a one-day first interval alone but still marks the row held', () => {
    const now = new Date()
    const result = calculateNextReview(4, 1, 0, 2.5)
    const held = holdForReflection(result, now)

    // The date was already within the cap — nothing to shorten…
    expect(held.nextReviewAt).toEqual(result.nextReviewAt)
    // …but the pass is still unexplained, so it must appear on the list.
    expect(held.heldNextReviewAt).toEqual(result.nextReviewAt)
  })
})

describe('isSubstantiveReflection', () => {
  it('rejects the hollow answers the floor exists for', () => {
    for (const hollow of ['yes', 'makes sense', 'the tests pass', 'idk', '   ok   ']) {
      expect(isSubstantiveReflection(hollow)).toBe(false)
    }
  })

  it('accepts an actual explanation', () => {
    expect(
      isSubstantiveReflection(
        'The %v verb formatted the error into plain text, so errors.Is stopped matching downstream.'
      )
    ).toBe(true)
  })

  it('is not fooled by whitespace padding', () => {
    expect(isSubstantiveReflection(' '.repeat(MIN_SUBSTANTIVE_REFLECTION_CHARS + 10))).toBe(false)
  })
})
