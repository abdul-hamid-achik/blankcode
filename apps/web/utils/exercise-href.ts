/**
 * Where an exercise lives on the site.
 *
 * The UUID route stays as a fallback for rows that have not been joined to a
 * track yet. Everything that has a slug should be cited as
 * `/tracks/{track}/{concept}/{slug}` so a shared link is readable.
 */

export const FIRST_SITTING_HREF = '/tracks/typescript/basics/ts-basics-001'

export interface LinkedExercise {
  id: string
  slug?: string
  concept?: {
    slug?: string
    track?: { slug?: string } | null
  } | null
}

export function exerciseHref(exercise: LinkedExercise): string {
  const track = exercise.concept?.track?.slug
  const concept = exercise.concept?.slug
  const slug = exercise.slug
  if (track && concept && slug) return `/tracks/${track}/${concept}/${slug}`
  return `/exercise/${exercise.id}`
}
