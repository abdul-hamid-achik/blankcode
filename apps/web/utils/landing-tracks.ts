/**
 * Every number the landing page shows, pinned to the content that shipped.
 *
 * `apps/web/__tests__/landing-tracks.test.ts` enforces each entry against
 * `content/tracks/` — the slug must be a directory with exercises in it and
 * the count must match the files on disk — so the page cannot advertise a
 * track that leads to an empty page or a total that has drifted.
 */
export interface LandingTrack {
  name: string
  slug: string
  color: string
  /** Exercise files under `content/tracks/{slug}/`, challenges included. */
  exercises: number
}

export const LANDING_TRACKS: LandingTrack[] = [
  { name: 'TypeScript', slug: 'typescript', color: '#3178C6', exercises: 30 },
  { name: 'Python', slug: 'python', color: '#3776AB', exercises: 24 },
  { name: 'Go', slug: 'go', color: '#00ADD8', exercises: 22 },
  { name: 'React', slug: 'react', color: '#61DAFB', exercises: 22 },
  { name: 'Rust', slug: 'rust', color: '#DEA584', exercises: 22 },
  { name: 'Vue', slug: 'vue', color: '#4FC08D', exercises: 19 },
]

/** Derived, never typed out — the per-track counts are the source of truth. */
export const EXERCISE_COUNT = LANDING_TRACKS.reduce((sum, track) => sum + track.exercises, 0)

/** Standalone challenges across all tracks (`content/tracks/{slug}/challenges/*.md`). */
export const CHALLENGE_COUNT = 31
