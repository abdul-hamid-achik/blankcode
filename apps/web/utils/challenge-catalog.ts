/**
 * How a challenge on /challenges is attributed to a track.
 *
 * `conceptId` is a UUID. Filtering with `conceptId.startsWith(track.slug)`
 * matched nothing and emptied every language chip. The list endpoint already
 * embeds `concept.track`; this is the only field that names the language.
 */

export interface CatalogExercise {
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
