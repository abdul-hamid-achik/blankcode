import { createDatabaseFromEnv } from '@blankcode/db/client'
import { readingExercises, readingSubmissions, users } from '@blankcode/db/schema'
import { generateText } from 'ai'
import { and, count, eq, max } from 'drizzle-orm'
import { resolveAiModel } from '../../../../utils/ai-model'
import { requireUserId } from '../../../../utils/auth'
import {
  buildGraderPrompt,
  GRADE_DAILY_WINDOW_MS,
  GRADE_HOURLY_WINDOW_MS,
  GRADE_USAGE_KIND,
  gradeBudget,
  maxScoreOf,
  parseGraderOutput,
  type RubricResult,
  scoreOf,
  validateExplanation,
} from '../../../../utils/reading-grader'
import { countSince, record } from '../../../../utils/usage'

/**
 * Grades an explanation against the authored rubric.
 *
 * The rubric is loaded here and never leaves: it goes into the prompt, and what
 * comes back out is a hit/miss per point that the learner has already earned
 * the right to see. Misses are returned in full — after the attempt, knowing
 * what a complete reading would have noticed IS the lesson.
 *
 * Two things are deliberately not the same as the explain endpoint they
 * otherwise mirror. The budget is counted but not spent up front, because a
 * grader that answers unparseably twice has cost the learner nothing and must
 * charge them nothing. And the score is computed from the authored weights in
 * `reading-grader.ts` rather than from anything the model returned.
 */

const ATTEMPTS = 2

export default defineEventHandler(async (event) => {
  if (!process.env['AI_GATEWAY_API_KEY'] && !process.env['VERCEL_OIDC_TOKEN']) {
    throw createError({ statusCode: 503, statusMessage: 'AI is not configured' })
  }

  const userId = await requireUserId(event)
  const slug = getRouterParam(event, 'slug') ?? ''
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'slug is required' })

  const body = await readBody<{ explanation?: unknown }>(event)
  const explanation = validateExplanation(body?.explanation)
  if (!explanation.ok) {
    throw createError({ statusCode: explanation.status, statusMessage: explanation.message })
  }

  const db = createDatabaseFromEnv()

  const exercise = await db.query.readingExercises.findFirst({
    where: and(eq(readingExercises.slug, slug), eq(readingExercises.isPublished, true)),
  })
  if (!exercise) {
    throw createError({ statusCode: 404, statusMessage: 'Reading exercise not found' })
  }

  const [user, usedThisHour, usedToday] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { aiModel: true, subscriptionStatus: true, subscriptionEndsAt: true },
    }),
    countSince(db, userId, GRADE_USAGE_KIND, GRADE_HOURLY_WINDOW_MS),
    countSince(db, userId, GRADE_USAGE_KIND, GRADE_DAILY_WINDOW_MS),
  ])

  const budget = gradeBudget(
    {
      subscriptionStatus: user?.subscriptionStatus ?? null,
      subscriptionEndsAt: user?.subscriptionEndsAt ?? null,
    },
    { usedThisHour, usedToday }
  )
  if (!budget.allowed) {
    throw createError({ statusCode: 429, statusMessage: budget.message ?? 'Budget reached' })
  }

  const model = resolveAiModel(user?.aiModel, budget.paid)

  /*
   * Two goes at a clean answer, then nothing.
   *
   * A thrown gateway error counts as a failed attempt for the same reason a
   * malformed one does: from here they are indistinguishable, and the honest
   * response to both is to say the grading did not happen rather than to
   * record a score nobody produced.
   */
  let results: RubricResult[] | null = null
  for (let attempt = 0; attempt < ATTEMPTS && results === null; attempt++) {
    const { system, prompt } = buildGraderPrompt({
      title: exercise.title,
      brief: exercise.brief,
      files: exercise.files,
      rubric: exercise.rubric,
      explanation: explanation.value,
      repair: attempt > 0,
    })

    try {
      const answer = await generateText({
        model,
        system,
        prompt,
        // Grading the same explanation twice should give the same score.
        temperature: 0,
        providerOptions: {
          gateway: { tags: ['app:blankcode', 'feature:reading-grade'] },
        },
      })
      results = parseGraderOutput(answer.text, exercise.rubric)
    } catch (error) {
      console.error(`[reading] grading ${slug} failed on attempt ${attempt + 1}:`, String(error))
    }
  }

  if (results === null) {
    // Nothing written: no submission, no usage event. The attempt was ours to
    // lose, not theirs.
    throw createError({
      statusCode: 502,
      statusMessage: 'The grader did not answer cleanly — try again',
    })
  }

  const score = scoreOf(results)
  const maxScore = maxScoreOf(exercise.rubric)

  await db.insert(readingSubmissions).values({
    userId,
    readingExerciseId: exercise.id,
    explanation: explanation.value,
    score,
    maxScore,
    rubricResults: results.map((result) => ({ ...result })),
    model,
  })

  await record(db, userId, GRADE_USAGE_KIND)

  const [totals] = await db
    .select({ attempts: count(), bestScore: max(readingSubmissions.score) })
    .from(readingSubmissions)
    .where(
      and(
        eq(readingSubmissions.userId, userId),
        eq(readingSubmissions.readingExerciseId, exercise.id)
      )
    )

  return {
    score,
    maxScore,
    rubricResults: results,
    attempts: totals ? Number(totals.attempts) : 1,
    bestScore:
      totals?.bestScore === null || totals === undefined ? score : Number(totals.bestScore),
    quota: {
      paid: budget.paid,
      dailyLimit: budget.dailyLimit,
      remainingToday:
        budget.remainingToday === null ? null : Math.max(0, budget.remainingToday - 1),
    },
  }
})
