import { createDatabaseFromEnv } from '@blankcode/db/client'
import { readingExercises, readingSubmissions, users } from '@blankcode/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { requireUserId } from '~/server/utils/auth'
import {
  GRADE_DAILY_WINDOW_MS,
  GRADE_HOURLY_WINDOW_MS,
  GRADE_USAGE_KIND,
  gradeBudget,
} from '~/server/utils/reading-grader'
import { countSince } from '~/server/utils/usage'

/**
 * One reading exercise: the brief and every file, which is the whole point —
 * you cannot explain what you have not been shown.
 *
 * The columns are listed by hand, and `rubric` is not among them. That is the
 * single security property of this feature: the rubric is the answer key, and
 * an endpoint that sends it turns the exercise into a copying task that still
 * reports a score. `__tests__/reading-routes.test.ts` fails if the word appears
 * in this file, because the leak would look completely correct in a browser.
 */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') ?? ''
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'slug is required' })

  const db = createDatabaseFromEnv()

  const [exercise] = await db
    .select({
      id: readingExercises.id,
      slug: readingExercises.slug,
      title: readingExercises.title,
      brief: readingExercises.brief,
      language: readingExercises.language,
      difficulty: readingExercises.difficulty,
      files: readingExercises.files,
    })
    .from(readingExercises)
    .where(and(eq(readingExercises.slug, slug), eq(readingExercises.isPublished, true)))
    .limit(1)

  if (!exercise) {
    throw createError({ statusCode: 404, statusMessage: 'Reading exercise not found' })
  }

  let userId: string | null = null
  try {
    userId = await requireUserId(event)
  } catch {
    userId = null
  }

  if (!userId) return { exercise, attempts: [], quota: null }

  const [attempts, user, usedThisHour, usedToday] = await Promise.all([
    db
      .select({
        id: readingSubmissions.id,
        score: readingSubmissions.score,
        maxScore: readingSubmissions.maxScore,
        createdAt: readingSubmissions.createdAt,
      })
      .from(readingSubmissions)
      .where(
        and(
          eq(readingSubmissions.userId, userId),
          eq(readingSubmissions.readingExerciseId, exercise.id)
        )
      )
      .orderBy(desc(readingSubmissions.createdAt))
      .limit(20),
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { subscriptionStatus: true, subscriptionEndsAt: true },
    }),
    countSince(db, userId, GRADE_USAGE_KIND, GRADE_HOURLY_WINDOW_MS),
    countSince(db, userId, GRADE_USAGE_KIND, GRADE_DAILY_WINDOW_MS),
  ])

  // Sent so the submit button can say what is left before it is pressed. A
  // limit someone only meets by hitting it reads as the app breaking.
  const budget = gradeBudget(
    {
      subscriptionStatus: user?.subscriptionStatus ?? null,
      subscriptionEndsAt: user?.subscriptionEndsAt ?? null,
    },
    { usedThisHour, usedToday }
  )

  return {
    exercise,
    attempts,
    quota: {
      paid: budget.paid,
      dailyLimit: budget.dailyLimit,
      remainingToday: budget.remainingToday,
    },
  }
})
