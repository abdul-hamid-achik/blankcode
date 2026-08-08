import { Drizzle } from '@blankcode/db/client'
import { exercises, reflections, reviewSchedules } from '@blankcode/db/schema'
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { BadRequestError, NotFoundError } from '../../api/errors.js'
import { isSubstantiveReflection } from '../reviews/scheduler.js'

/**
 * The human's answers to the reflect questions, recorded verbatim.
 *
 * Deliberately no quality scoring here: the value of the row is that the
 * answer exists and can be read back next to the exercise. Judging answers is
 * a later feature (and probably the scheduler's, not this table's).
 */

export interface ReflectionRow {
  id: string
  exerciseId: string
  question: string
  answer: string
  createdAt: Date
}

interface ReflectionsServiceShape {
  readonly create: (
    userId: string,
    input: { exerciseId: string; question: string; answer: string }
  ) => Effect.Effect<ReflectionRow, NotFoundError | BadRequestError>
  readonly listByExercise: (
    userId: string,
    exerciseId: string
  ) => Effect.Effect<ReflectionRow[], never>
}

export class ReflectionsService extends Context.Tag('ReflectionsService')<
  ReflectionsService,
  ReflectionsServiceShape
>() {}

export const ReflectionsServiceLive = Layer.effect(
  ReflectionsService,
  Effect.gen(function* () {
    const db = yield* Drizzle

    return {
      create: (userId, input) =>
        Effect.gen(function* () {
          const answer = input.answer.trim()
          const question = input.question.trim()
          if (!answer || !question) {
            // An empty reflection is not a reflection; refusing beats storing
            // a row that would read as evidence of understanding.
            return yield* Effect.fail(
              new BadRequestError({
                message: 'A reflection needs both the question and a real answer.',
              })
            )
          }

          const exercise = yield* Effect.tryPromise({
            try: () =>
              db.query.exercises.findFirst({
                where: eq(exercises.id, input.exerciseId),
                columns: { id: true },
              }),
            catch: () => new NotFoundError({ resource: 'exercise', id: input.exerciseId }),
          })
          if (!exercise) {
            return yield* Effect.fail(
              new NotFoundError({ resource: 'exercise', id: input.exerciseId })
            )
          }

          const rows = yield* Effect.tryPromise({
            try: () =>
              db
                .insert(reflections)
                .values({ userId, exerciseId: input.exerciseId, question, answer })
                .returning({
                  id: reflections.id,
                  exerciseId: reflections.exerciseId,
                  question: reflections.question,
                  answer: reflections.answer,
                  createdAt: reflections.createdAt,
                }),
            catch: () => new BadRequestError({ message: 'Could not record the reflection' }),
          })
          const row = rows[0]
          if (!row) {
            return yield* Effect.fail(
              new BadRequestError({ message: 'Could not record the reflection' })
            )
          }

          /*
           * The reflect → SM-2 signal. An agent pass leaves the schedule
           * held (nextReviewAt capped at a day, the real date parked in
           * heldNextReviewAt); a substantive answer is what releases it. A
           * hollow answer — recorded above, because it is still the honest
           * transcript — releases nothing. Best-effort on purpose: the
           * reflection is the record, the unlock is bookkeeping, and a
           * failed unlock only means the review arrives sooner than earned.
           */
          if (isSubstantiveReflection(answer)) {
            yield* Effect.tryPromise({
              try: () =>
                db
                  .update(reviewSchedules)
                  .set({
                    nextReviewAt: sql`${reviewSchedules.heldNextReviewAt}`,
                    heldNextReviewAt: null,
                    updatedAt: new Date(),
                  })
                  .where(
                    and(
                      eq(reviewSchedules.userId, userId),
                      eq(reviewSchedules.exerciseId, input.exerciseId),
                      isNotNull(reviewSchedules.heldNextReviewAt)
                    )
                  ),
              catch: () => new BadRequestError({ message: 'Could not release the review hold' }),
            }).pipe(Effect.catchAll(() => Effect.void))
          }

          return row
        }),

      listByExercise: (userId, exerciseId) =>
        Effect.tryPromise({
          try: () =>
            db
              .select({
                id: reflections.id,
                exerciseId: reflections.exerciseId,
                question: reflections.question,
                answer: reflections.answer,
                createdAt: reflections.createdAt,
              })
              .from(reflections)
              .where(and(eq(reflections.userId, userId), eq(reflections.exerciseId, exerciseId)))
              .orderBy(desc(reflections.createdAt)),
          catch: () => [] as ReflectionRow[],
        }).pipe(Effect.orElseSucceed(() => [] as ReflectionRow[])),
    }
  })
)
