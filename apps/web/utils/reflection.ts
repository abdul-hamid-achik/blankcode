/**
 * Client-side mirror of the schedule's "substantive reflection" floor.
 *
 * Source of truth for the gate is `apps/api/src/modules/reviews/scheduler.ts`
 * (`MIN_SUBSTANTIVE_REFLECTION_CHARS`). Kept by copy rather than import
 * because the web app does not depend on the API package for pure constants,
 * and a length floor that drifts only affects client copy (the server still
 * decides whether the hold is released).
 *
 * Length is a proxy: "yes", "makes sense", and "the tests pass" stay hollow.
 */

export const MIN_SUBSTANTIVE_REFLECTION_CHARS = 40

export function isSubstantiveReflection(answer: string): boolean {
  return answer.trim().length >= MIN_SUBSTANTIVE_REFLECTION_CHARS
}

/**
 * First pass-side question for a type — same catalogue the MCP reflect tool
 * returns after a green verdict. Used when the human explains from the site
 * without an agent having posed the question first.
 */
export function defaultReflectQuestion(exerciseType: string | undefined): string {
  const byType: Record<string, string> = {
    review: 'What class of defect was seeded here, and where would it have bitten in production?',
    challenge: 'Walk me through the approach in your own words — what was the key decision?',
    blank: 'Cover the answer: can you say from memory what goes in each blank, and why?',
    turn: 'Which turn spent the budget best, and what would you cut next time?',
    context: 'What context did the answer actually need, and what was noise?',
  }
  const fallback = byType['challenge']
  if (!fallback) {
    return 'Walk me through the approach in your own words — what was the key decision?'
  }
  return byType[exerciseType ?? ''] ?? fallback
}
