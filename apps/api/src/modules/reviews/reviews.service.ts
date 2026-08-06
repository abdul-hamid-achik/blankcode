import { Drizzle } from '@blankcode/db/client'
import { reviewSchedules } from '@blankcode/db/schema'
import type { ReviewExercise } from '@blankcode/shared'
import { and, eq, lte } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
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
  ) => Effect.Effect<void, NotFoundError>
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
    ): Effect.Effect<void, NotFoundError> {
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
      })
    }

    return ReviewsService.of({
      scheduleReview: (userId, exerciseId, passed) => upsertSchedule(userId, exerciseId, passed),

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
            const exercise = schedule.exercise
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
    })
  })
)
