/**
 * How a challenge on /challenges is attributed to a track.
 *
 * `conceptId` is a UUID. Filtering with `conceptId.startsWith(track.slug)`
 * matched nothing and emptied every language chip. The list endpoint already
 * embeds `concept.track`; this is the only field that names the language.
 */

export interface CatalogExercise {
  id?: string
  slug?: string
  type: string
  conceptId: string
  concept?: {
    slug?: string
    name?: string
    track?: { slug?: string; name?: string } | null
  } | null
}

export function trackSlugForExercise(exercise: CatalogExercise): string | null {
  return exercise.concept?.track?.slug ?? null
}

export function challengeBelongsToTrack(exercise: CatalogExercise, trackSlug: string): boolean {
  if (trackSlug === 'all') return true
  return trackSlugForExercise(exercise) === trackSlug
}

export function trackLabelForExercise(exercise: CatalogExercise): string {
  return exercise.concept?.track?.name ?? 'Challenge'
}

/**
 * The /challenges catalogue mixes three jobs that share `type: 'challenge'`:
 * write-from-scratch, build-the-tool, and pin-it-down. Kind is the concept
 * slug, not the exercise type — the type is how the runner grades them.
 */
export type CatalogKind = 'challenge' | 'tool' | 'spec' | 'other'

export function catalogKind(exercise: CatalogExercise): CatalogKind {
  switch (exercise.concept?.slug) {
    case 'tooling':
    case 'testing-and-tooling':
      return 'tool'
    case 'specification':
      return 'spec'
    case 'challenges':
      return 'challenge'
    default:
      return 'other'
  }
}

export function catalogKindLabel(kind: CatalogKind): string {
  switch (kind) {
    case 'tool':
      return 'Build the tool'
    case 'spec':
      return 'Pin it down'
    case 'challenge':
      return 'From scratch'
    default:
      return 'Other'
  }
}

export function catalogKindMatches(exercise: CatalogExercise, kind: string): boolean {
  if (kind === 'all') return true
  return catalogKind(exercise) === kind
}

export function challengeCountLabel(count: number): string {
  return count === 1 ? '1 challenge' : `${count} challenges`
}
