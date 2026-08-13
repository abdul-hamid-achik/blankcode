import { createDatabaseFromEnv } from '@blankcode/db/client'
import { concepts, exercises, reviewSchedules, tracks, userProgress } from '@blankcode/db/schema'
import { and, asc, eq, lte } from 'drizzle-orm'
import { requireUserId } from '~/server/utils/auth'
import { selectContinueTarget, type ContinueCandidate } from '~/utils/continue-target'

/**
 * What to do after finishing an exercise.
 *
 * Due recall wins while anything is still due — the next neighbour in track
 * order is almost always work the learner already completed, which is how
 * Continue after a review sitting used to loop. When the queue is empty,
 * Continue is the first exercise on this track they have not completed.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)

  const id = getRouterParam(event, 'id') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    throw createError({ statusCode: 404, statusMessage: 'Exercise not found' })
  }

  const db = createDatabaseFromEnv()

  const current = await db
    .select({
      conceptId: concepts.id,
      trackId: tracks.id,
      trackSlug: tracks.slug,
      trackName: tracks.name,
    })
    .from(exercises)
    .innerJoin(concepts, eq(concepts.id, exercises.conceptId))
    .innerJoin(tracks, eq(tracks.id, concepts.trackId))
    .where(eq(exercises.id, id))
    .limit(1)

  const here = current[0]
  if (!here) throw createError({ statusCode: 404, statusMessage: 'Exercise not found' })

  const [dueRows, doneRows, trackRows] = await Promise.all([
    db
      .select({
        id: exercises.id,
        slug: exercises.slug,
        title: exercises.title,
        difficulty: exercises.difficulty,
        conceptName: concepts.name,
        trackName: tracks.name,
      })
      .from(reviewSchedules)
      .innerJoin(exercises, eq(exercises.id, reviewSchedules.exerciseId))
      .innerJoin(concepts, eq(concepts.id, exercises.conceptId))
      .innerJoin(tracks, eq(tracks.id, concepts.trackId))
      .where(and(eq(reviewSchedules.userId, userId), lte(reviewSchedules.nextReviewAt, new Date())))
      .orderBy(asc(reviewSchedules.nextReviewAt)),
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
        trackName: tracks.name,
        conceptId: concepts.id,
      })
      .from(exercises)
      .innerJoin(concepts, eq(concepts.id, exercises.conceptId))
      .innerJoin(tracks, eq(tracks.id, concepts.trackId))
      .where(
        and(
          eq(concepts.trackId, here.trackId),
          eq(exercises.isPublished, true),
          eq(concepts.isPublished, true)
        )
      )
      .orderBy(asc(concepts.order), asc(exercises.order)),
  ])

  const due: ContinueCandidate[] = dueRows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    difficulty: row.difficulty,
    conceptName: row.conceptName,
    trackName: row.trackName,
  }))

  const track: ContinueCandidate[] = trackRows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    difficulty: row.difficulty,
    conceptName: row.conceptName,
    trackName: row.trackName,
    sameConcept: row.conceptId === here.conceptId,
  }))

  const selection = selectContinueTarget({
    due,
    justPassedId: id,
    track,
    completedIds: new Set(doneRows.map((row) => row.exerciseId)),
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
          sameConcept: selection.next.sameConcept ?? selection.next.id === id,
        }
      : null,
    track: { slug: here.trackSlug, name: here.trackName },
  }
})
