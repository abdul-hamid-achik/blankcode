/**
 * The floor under "the human actually explained it".
 *
 * One question's answer, so far lower than the reading grader's 120 — but high
 * enough that "yes", "makes sense" and "the tests pass" stay hollow. Length is
 * a proxy, and an imperfect one; it is also the only judge that costs nothing
 * and cannot be flattered.
 *
 * Used by the SM-2 hold release, the drill evidence filter, and the exercise
 * page's explain form. One source so the three cannot disagree.
 */

export const MIN_SUBSTANTIVE_REFLECTION_CHARS = 40

export function isSubstantiveReflection(answer: string): boolean {
  return answer.trim().length >= MIN_SUBSTANTIVE_REFLECTION_CHARS
}

/** Inverse of substantive — what the schedule refused to believe. */
export function isHollowReflection(answer: string): boolean {
  return !isSubstantiveReflection(answer)
}
