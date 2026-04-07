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
