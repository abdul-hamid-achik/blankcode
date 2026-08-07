import { createDatabaseFromEnv } from '@blankcode/db/client'
import { concepts, exercises, tracks } from '@blankcode/db/schema'
import { and, asc, eq, gt, notInArray, or } from 'drizzle-orm'
import { requireUserId } from '../../../../utils/auth'

/**
 * What to do after finishing an exercise.
 *
 * Passing used to leave you on the page you had just finished, with the result
 * on screen and nowhere to go. The answer is almost always "the next one in
 * this concept", and when that runs out it is "the first one in the next
 * concept" — so the page should not have to ask the learner to work it out.
 *
 * Ordering is (concept.order, exercise.order), the same order the track page
 * lists them in. Anything else would send someone somewhere they did not
 * expect from a button that says "next".
 */
export default defineEventHandler(async (event) => {
  await requireUserId(event)

  const id = getRouterParam(event, 'id') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    throw createError({ statusCode: 404, statusMessage: 'Exercise not found' })
  }

  const db = createDatabaseFromEnv()

  const current = await db
    .select({
      exerciseOrder: exercises.order,
      conceptId: concepts.id,
      conceptOrder: concepts.order,
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

  const [next] = await db
    .select({
      id: exercises.id,
      slug: exercises.slug,
      title: exercises.title,
      difficulty: exercises.difficulty,
      conceptName: concepts.name,
      sameConcept: eq(concepts.id, here.conceptId),
    })
    .from(exercises)
    .innerJoin(concepts, eq(concepts.id, exercises.conceptId))
    .where(
      and(
        eq(concepts.trackId, here.trackId),
        eq(exercises.isPublished, true),
        eq(concepts.isPublished, true),
        // The session forms are gated until their surfaces exist; "next"
        // must not land on a gate. Drop once the turn/context views ship.
        notInArray(exercises.type, ['turn', 'context']),
        // Later in this concept, or anywhere in a later concept.
        or(
          and(eq(concepts.id, here.conceptId), gt(exercises.order, here.exerciseOrder)),
          gt(concepts.order, here.conceptOrder)
        )
      )
    )
    .orderBy(asc(concepts.order), asc(exercises.order))
    .limit(1)

  return {
    // Null means the track is finished, which the page should say rather than
    // showing a dead button.
    next: next ?? null,
    track: { slug: here.trackSlug, name: here.trackName },
  }
})
