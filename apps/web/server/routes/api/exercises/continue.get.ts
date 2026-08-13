import { createDatabaseFromEnv } from '@blankcode/db/client'
import { concepts, exercises, tracks, userProgress } from '@blankcode/db/schema'
import { and, asc, desc, eq } from 'drizzle-orm'
import { requireUserId } from '~/server/utils/auth'
import { selectContinueTarget, type ContinueCandidate } from '~/utils/continue-target'

/**
 * Where you left off — empty-queue Continue.
 *
 * This endpoint is the fallback after the due list is empty. It must name
 * something the learner has not completed, or honestly return null. Filtering
 * only in SQL hid the rule; the same selector the post-pass button uses
 * is what decides.
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

  if (!recent) return { kind: 'none' as const, next: null }

  const [done, trackRows] = await Promise.all([
    db
      .select({ exerciseId: userProgress.exerciseId })
      .from(userProgress)
      .where(and(eq(userProgress.userId, userId), eq(userProgress.isCompleted, true))),
    db
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
          eq(concepts.isPublished, true)
        )
      )
      .orderBy(asc(concepts.order), asc(exercises.order)),
  ])

  const track: ContinueCandidate[] = trackRows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    difficulty: row.difficulty,
    conceptName: row.conceptName,
    trackName: row.trackName,
  }))

  const selection = selectContinueTarget({
    due: [],
    track,
    completedIds: new Set(done.map((row) => row.exerciseId)),
  })

  return {
    kind: selection.kind,
    next: selection.next
      ? {
          id: selection.next.id,
          slug: selection.next.slug ?? '',
          title: selection.next.title,
          difficulty: selection.next.difficulty ?? '',
          conceptName: selection.next.conceptName,
          trackName: selection.next.trackName,
          trackSlug: trackRows.find((row) => row.id === selection.next?.id)?.trackSlug ?? '',
        }
      : null,
  }
})
