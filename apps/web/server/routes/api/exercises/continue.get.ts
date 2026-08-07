import { createDatabaseFromEnv } from '@blankcode/db/client'
import { concepts, exercises, tracks, userProgress } from '@blankcode/db/schema'
import { and, asc, desc, eq, notInArray } from 'drizzle-orm'
import { requireUserId } from '../../../utils/auth'

/**
 * Where you left off.
 *
 * The empty states used to offer categories — "Browse tracks", "Try a
 * challenge" — which is the product shrugging. The person standing in an
 * empty review queue wants the next concrete thing, and the data to name it
 * already exists: their most recently practiced track, walked in track order,
 * first exercise they have not completed.
 *
 * Returns { next: null } for a fresh account or a finished track; the caller
 * falls back to browsing, which is then honest rather than lazy.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const db = createDatabaseFromEnv()

  // The track the user last touched, via their most recent progress row.
  const [recent] = await db
    .select({ trackId: concepts.trackId })
    .from(userProgress)
    .innerJoin(exercises, eq(exercises.id, userProgress.exerciseId))
    .innerJoin(concepts, eq(concepts.id, exercises.conceptId))
    .where(eq(userProgress.userId, userId))
    .orderBy(desc(userProgress.updatedAt))
    .limit(1)

  if (!recent) return { next: null }

  const done = await db
    .select({ exerciseId: userProgress.exerciseId })
    .from(userProgress)
    .where(and(eq(userProgress.userId, userId), eq(userProgress.isCompleted, true)))
  const doneIds = done.map((row) => row.exerciseId)

  const [next] = await db
    .select({
      id: exercises.id,
      slug: exercises.slug,
      title: exercises.title,
      difficulty: exercises.difficulty,
      conceptName: concepts.name,
      trackSlug: tracks.slug,
      trackName: tracks.name,
    })
    .from(exercises)
    .innerJoin(concepts, eq(concepts.id, exercises.conceptId))
    .innerJoin(tracks, eq(tracks.id, concepts.trackId))
    .where(
      and(
        eq(concepts.trackId, recent.trackId),
        eq(exercises.isPublished, true),
        eq(concepts.isPublished, true),
        ...(doneIds.length > 0 ? [notInArray(exercises.id, doneIds)] : [])
      )
    )
    .orderBy(asc(concepts.order), asc(exercises.order))
    .limit(1)

  return { next: next ?? null }
})
