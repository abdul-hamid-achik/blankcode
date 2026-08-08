import { createDatabaseFromEnv } from '@blankcode/db/client'
import { readingExercises, readingSubmissions } from '@blankcode/db/schema'
import { count, eq, max, sql } from 'drizzle-orm'
import { requireUserId } from '../../../utils/auth'

/**
 * The published reading exercises.
 *
 * Public, because the list is the argument for the form: someone who has never
 * signed in should be able to read what is on offer and have a crawler read it
 * too. The marks — attempts and best score — are the only part that needs a
 * session, so a missing or expired token narrows the response instead of
 * refusing it.
 *
 * `fileCount` is computed in Postgres. Selecting `files` to call `.length` in
 * here would ship every byte of every codebase to render a list of titles.
 */
export default defineEventHandler(async (event) => {
  const db = createDatabaseFromEnv()

  const exercises = await db
    .select({
      id: readingExercises.id,
      slug: readingExercises.slug,
      title: readingExercises.title,
      brief: readingExercises.brief,
      language: readingExercises.language,
      difficulty: readingExercises.difficulty,
      fileCount: sql<number>`jsonb_array_length(${readingExercises.files})`,
    })
    .from(readingExercises)
    .where(eq(readingExercises.isPublished, true))
    // The enum orders itself (beginner → expert), so easiest first, then by
    // title. Anything else makes the list reshuffle as content is added.
    .orderBy(readingExercises.difficulty, readingExercises.title)

  let userId: string | null = null
  try {
    userId = await requireUserId(event)
  } catch {
    userId = null
  }

  /*
   * One aggregate for the whole list rather than a join, because the marks are
   * the optional half: signed out this query does not run at all, and the rows
   * above are the same either way.
   *
   * `bestMaxScore` is aggregated alongside the best score instead of being
   * derived from the rubric — the rubric is not allowed out of the server, and
   * the number a learner was actually graded against is on their own attempt.
   */
  const marks = userId
    ? await db
        .select({
          readingExerciseId: readingSubmissions.readingExerciseId,
          attempts: count(),
          bestScore: max(readingSubmissions.score),
          bestMaxScore: max(readingSubmissions.maxScore),
        })
        .from(readingSubmissions)
        .where(eq(readingSubmissions.userId, userId))
        .groupBy(readingSubmissions.readingExerciseId)
    : []

  const byExercise = new Map(marks.map((mark) => [mark.readingExerciseId, mark]))

  return {
    exercises: exercises.map((exercise) => {
      const mark = byExercise.get(exercise.id)
      return {
        id: exercise.id,
        slug: exercise.slug,
        title: exercise.title,
        brief: exercise.brief,
        language: exercise.language,
        difficulty: exercise.difficulty,
        fileCount: Number(exercise.fileCount),
        attempts: mark === undefined ? 0 : Number(mark.attempts),
        bestScore: mark === undefined || mark.bestScore === null ? null : Number(mark.bestScore),
        bestMaxScore:
          mark === undefined || mark.bestMaxScore === null ? null : Number(mark.bestMaxScore),
      }
    }),
  }
})
