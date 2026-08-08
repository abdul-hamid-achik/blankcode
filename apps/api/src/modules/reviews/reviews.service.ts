import { Drizzle } from '@blankcode/db/client'
import { reviewSchedules } from '@blankcode/db/schema'
import type { ReviewExercise } from '@blankcode/shared'
import { and, eq, gt, isNotNull, lte } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { redactExercise } from '../exercises/redact.js'
import { NotFoundError } from '../../api/errors.js'
import { calculateNextReview, type ReviewQuality } from './scheduler.js'

interface ReviewsServiceShape {
  readonly scheduleReview: (
    userId: string,
    exerciseId: string,
    passed: boolean
  ) => Effect.Effect<void, NotFoundError>
  readonly getDueReviews: (userId: string) => Effect.Effect<ReviewExercise[], NotFoundError>
  readonly getDueCount: (userId: string) => Effect.Effect<number, never>
  readonly recordReview: (
    userId: string,
    exerciseId: string,
    passed: boolean,
    quality?: ReviewQuality
  ) => Effect.Effect<{ nextReviewAt: string; intervalDays: number }, NotFoundError>
  readonly getUpcoming: (
    userId: string
  ) => Effect.Effect<
    { dueNow: number; next: { date: string; count: number } | null },
    NotFoundError
  >
  readonly getUnexplained: (userId: string) => Effect.Effect<UnexplainedPass[], never>
}

/** An agent pass whose review the schedule is holding close, awaiting the human's explanation. */
export interface UnexplainedPass {
  exerciseId: string
  title: string
  /** When the agent's passing submission moved the schedule. */
  passedAt: string | null
  /** Where the review is parked while unexplained — at most a day out. */
  nextReviewAt: string
}

export class ReviewsService extends Context.Tag('ReviewsService')<
  ReviewsService,
  ReviewsServiceShape
>() {}

export const ReviewsServiceLive = Layer.effect(
  ReviewsService,
  Effect.gen(function* () {
    const db = yield* Drizzle

    function upsertSchedule(
      userId: string,
      exerciseId: string,
      passed: boolean,
      explicitQuality?: ReviewQuality
    ): Effect.Effect<{ nextReviewAt: string; intervalDays: number }, NotFoundError> {
      return Effect.gen(function* () {
        const existingSchedule = yield* Effect.tryPromise({
          try: () =>
            db.query.reviewSchedules.findFirst({
              where: and(
                eq(reviewSchedules.userId, userId),
                eq(reviewSchedules.exerciseId, exerciseId)
              ),
            }),
          catch: () =>
            new NotFoundError({ resource: 'ReviewSchedule', id: `${userId}:${exerciseId}` }),
        })

        // If user provided a self-rating (3=hard, 4=good, 5=easy), use it.
        // Otherwise default: passed → good (4), failed → fail (1).
        const quality: ReviewQuality = passed ? (explicitQuality ?? 4) : 1
        const currentInterval = existingSchedule?.intervalDays ?? 1
        const currentRepetitions = existingSchedule?.repetitions ?? 0
        const currentEaseFactor = existingSchedule?.easeFactor ?? 2.5

        const result = calculateNextReview(
          quality,
          currentInterval,
          currentRepetitions,
          currentEaseFactor
        )

        if (existingSchedule) {
          yield* Effect.tryPromise({
            try: () =>
              db
                .update(reviewSchedules)
                .set({
                  intervalDays: result.intervalDays,
                  repetitions: result.repetitions,
                  easeFactor: result.easeFactor,
                  nextReviewAt: result.nextReviewAt,
                  // A completed human review is recall demonstrated — any
                  // unexplained-agent-pass hold is settled by it.
                  heldNextReviewAt: null,
                  lastReviewedAt: new Date(),
                  updatedAt: new Date(),
                })
                .where(eq(reviewSchedules.id, existingSchedule.id)),
            catch: () => new NotFoundError({ resource: 'ReviewSchedule', id: existingSchedule.id }),
          })
        } else {
          yield* Effect.tryPromise({
            try: () =>
              db.insert(reviewSchedules).values({
                userId,
                exerciseId,
                intervalDays: result.intervalDays,
                repetitions: result.repetitions,
                easeFactor: result.easeFactor,
                nextReviewAt: result.nextReviewAt,
                lastReviewedAt: new Date(),
              }),
            catch: () =>
              new NotFoundError({ resource: 'ReviewSchedule', id: `${userId}:${exerciseId}` }),
          })
        }

        return {
          nextReviewAt: result.nextReviewAt.toISOString(),
          intervalDays: result.intervalDays,
        }
      })
    }

    return ReviewsService.of({
      scheduleReview: (userId, exerciseId, passed) =>
        upsertSchedule(userId, exerciseId, passed).pipe(Effect.asVoid),

      getDueReviews: (userId) =>
        Effect.gen(function* () {
          const dueSchedules = yield* Effect.tryPromise({
            try: () =>
              db.query.reviewSchedules.findMany({
                where: and(
                  eq(reviewSchedules.userId, userId),
                  lte(reviewSchedules.nextReviewAt, new Date())
                ),
                with: {
                  exercise: {
                    with: {
                      concept: {
                        with: {
                          track: true,
                        },
                      },
                    },
                  },
                },
                orderBy: (schedules, { asc }) => [asc(schedules.nextReviewAt)],
              }),
            catch: () => new NotFoundError({ resource: 'ReviewSchedules', id: userId }),
          })

          const reviewExercises: ReviewExercise[] = dueSchedules.map((schedule) => {
            /*
             * Redacted, like every other path that ships an exercise. This one
             * spread the raw row, so the daily review queue — the surface a
             * learner opens most — handed back `solutionCode` and every blank's
             * answer for every exercise due that day.
             *
             * The cast is because `ReviewExercise extends Exercise`, and
             * `Exercise` still declares the fields that were just removed. The
             * shared type is what should change; until it does, this is the
             * honest place to note that the value no longer matches it.
             */
            const exercise = redactExercise(
              schedule.exercise as unknown as Record<string, unknown>
            ) as unknown as typeof schedule.exercise
            return {
              ...exercise,
              difficulty: exercise.difficulty as ReviewExercise['difficulty'],
              type: exercise.type as ReviewExercise['type'],
              schedule: {
                id: schedule.id,
                userId: schedule.userId,
                exerciseId: schedule.exerciseId,
                intervalDays: schedule.intervalDays,
                repetitions: schedule.repetitions,
                easeFactor: schedule.easeFactor,
                nextReviewAt: schedule.nextReviewAt.toISOString(),
                lastReviewedAt: schedule.lastReviewedAt?.toISOString() ?? null,
                createdAt: schedule.createdAt.toISOString(),
                updatedAt: schedule.updatedAt.toISOString(),
              },
            }
          })

          return reviewExercises
        }),

      getDueCount: (userId) =>
        Effect.gen(function* () {
          const count = yield* Effect.tryPromise({
            try: () =>
              db
                .select({ count: reviewSchedules.id })
                .from(reviewSchedules)
                .where(
                  and(
                    eq(reviewSchedules.userId, userId),
                    lte(reviewSchedules.nextReviewAt, new Date())
                  )
                )
                .then((r) => r.length),
            catch: (_err) => new Error('Failed to get due count'),
          }).pipe(Effect.catchAll(() => Effect.succeed(0)))

          return count
        }),

      recordReview: (userId, exerciseId, passed, quality) =>
        upsertSchedule(userId, exerciseId, passed, quality),

      getUnexplained: (userId) =>
        Effect.tryPromise({
          try: () =>
            db.query.reviewSchedules.findMany({
              where: and(
                eq(reviewSchedules.userId, userId),
                isNotNull(reviewSchedules.heldNextReviewAt)
              ),
              with: { exercise: { columns: { title: true } } },
              orderBy: (schedules, { desc }) => [desc(schedules.lastReviewedAt)],
            }),
          catch: () => [] as never[],
        }).pipe(
          Effect.map((rows) =>
            rows.map((row): UnexplainedPass => ({
              exerciseId: row.exerciseId,
              title: row.exercise?.title ?? 'Exercise',
              passedAt: row.lastReviewedAt?.toISOString() ?? null,
              nextReviewAt: row.nextReviewAt.toISOString(),
            }))
          ),
          // The list is a nudge, not a gate: an empty answer degrades the
          // dashboard corner, never the page.
          Effect.orElseSucceed(() => [] as UnexplainedPass[])
        ),

      getUpcoming: (userId) =>
        Effect.gen(function* () {
          const now = new Date()
          const [dueNow, upcoming] = yield* Effect.all([
            Effect.tryPromise({
              try: () =>
                db
                  .select({ id: reviewSchedules.id })
                  .from(reviewSchedules)
                  .where(
                    and(eq(reviewSchedules.userId, userId), lte(reviewSchedules.nextReviewAt, now))
                  )
                  .then((rows) => rows.length),
              catch: () => new NotFoundError({ resource: 'ReviewSchedule', id: userId }),
            }),
            Effect.tryPromise({
              try: () =>
                db.query.reviewSchedules.findMany({
                  where: and(
                    eq(reviewSchedules.userId, userId),
                    gt(reviewSchedules.nextReviewAt, now)
                  ),
                  columns: { nextReviewAt: true },
                  orderBy: (schedules, { asc }) => [asc(schedules.nextReviewAt)],
                }),
              catch: () => new NotFoundError({ resource: 'ReviewSchedule', id: userId }),
            }),
          ])

          const first = upcoming[0]
          if (!first) return { dueNow, next: null }

          // "The next batch" is everything that lands on the same calendar
          // day (UTC) as the earliest upcoming review — the day the person
          // will actually sit down to.
          const day = first.nextReviewAt.toISOString().slice(0, 10)
          const count = upcoming.filter(
            (s) => s.nextReviewAt.toISOString().slice(0, 10) === day
          ).length
          return { dueNow, next: { date: day, count } }
        }),
    })
  })
)
