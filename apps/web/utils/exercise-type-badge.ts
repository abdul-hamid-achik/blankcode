/**
 * Concept-list type labels.
 *
 * Emoji pills hid the type from anyone who does not read pictograms, and
 * `agent` was missing — the same empty-pill bug `review` used to have.
 * Mono words, one per exercise type.
 */

export interface ExerciseTypeBadge {
  label: string
}

const BADGES: Record<string, ExerciseTypeBadge> = {
  blank: { label: 'blank' },
  challenge: { label: 'challenge' },
  review: { label: 'review' },
  turn: { label: 'three messages' },
  context: { label: 'context' },
  agent: { label: 'supervise' },
}

export function exerciseTypeBadge(type: string | undefined): ExerciseTypeBadge {
  if (!type) return BADGES['blank']!
  return BADGES[type] ?? { label: type }
}
