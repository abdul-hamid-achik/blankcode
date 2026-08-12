/**
 * Substantive-reflection floor — re-exported from shared so the exercise
 * page, the drill generator, and the SM-2 hold release share one constant.
 */

export { isSubstantiveReflection, MIN_SUBSTANTIVE_REFLECTION_CHARS } from '@blankcode/shared'

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
