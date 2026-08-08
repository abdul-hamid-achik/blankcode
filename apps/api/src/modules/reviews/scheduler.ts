// Quality ratings for submission results
export type ReviewQuality = 0 | 1 | 2 | 3 | 4 | 5
// 0-2: fail/reset, 3: hard, 4: good, 5: easy

export interface SM2Result {
  intervalDays: number
  repetitions: number
  easeFactor: number
  nextReviewAt: Date
}

/**
 * SM-2 inspired scheduler.
 * quality: 0=fail, 3=hard, 4=good, 5=easy
 */
export function calculateNextReview(
  quality: ReviewQuality,
  currentInterval: number,
  currentRepetitions: number,
  currentEaseFactor: number
): SM2Result {
  if (quality < 3) {
    // Failed/incorrect -- reset
    return {
      intervalDays: 1,
      repetitions: 0,
      easeFactor: Math.max(1.3, currentEaseFactor - 0.2),
      nextReviewAt: addDays(new Date(), 1),
    }
  }

  const newEaseFactor = Math.max(
    1.3,
    currentEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  )

  let intervalDays: number
  if (currentRepetitions === 0) {
    intervalDays = 1
  } else if (currentRepetitions === 1) {
    intervalDays = 3
  } else {
    intervalDays = Math.round(currentInterval * newEaseFactor)
  }

  // Quality-based interval modifier
  if (quality === 3) intervalDays = Math.round(intervalDays * 0.8) // hard
  if (quality === 5) intervalDays = Math.round(intervalDays * 1.3) // easy

  return {
    intervalDays,
    repetitions: currentRepetitions + 1,
    easeFactor: newEaseFactor,
    nextReviewAt: addDays(new Date(), intervalDays),
  }
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * The unexplained-pass hold: a pass the human cannot explain is a pass the
 * schedule should not believe.
 *
 * When an agent's submission passes a non-blank exercise, the SM-2 state
 * advances as usual — the curriculum was followed — but the DATE is not
 * trusted yet: nextReviewAt is capped at one day out and the full computed
 * date parks in heldNextReviewAt. A substantive reflection promotes the held
 * date back into nextReviewAt; silence leaves the review due tomorrow, where
 * the human's own recall settles the question the pass could not.
 */
export const REFLECTION_HOLD_DAYS = 1

/**
 * The floor under "the human actually explained it". One question's answer,
 * so far lower than the reading grader's 120 — but high enough that "yes",
 * "makes sense" and "the tests pass" stay hollow. Length is a proxy, and an
 * imperfect one; it is also the only judge that costs nothing and cannot be
 * flattered.
 */
export const MIN_SUBSTANTIVE_REFLECTION_CHARS = 40

export function isSubstantiveReflection(answer: string): boolean {
  return answer.trim().length >= MIN_SUBSTANTIVE_REFLECTION_CHARS
}

/**
 * Caps a computed schedule while the pass awaits its explanation.
 * heldNextReviewAt is always set — even when the cap changes nothing, the
 * row must appear on the "passes you haven't explained" list.
 */
export function holdForReflection(
  result: SM2Result,
  now: Date = new Date()
): { nextReviewAt: Date; heldNextReviewAt: Date } {
  const cap = addDays(now, REFLECTION_HOLD_DAYS)
  return {
    nextReviewAt: result.nextReviewAt <= cap ? result.nextReviewAt : cap,
    heldNextReviewAt: result.nextReviewAt,
  }
}
