import { describe, expect, it } from 'vitest'
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
