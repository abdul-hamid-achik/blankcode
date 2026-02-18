import { Drizzle } from '@blankcode/db/client'
import { exercises, submissions } from '@blankcode/db/schema'
import type { SubmissionCreateInput } from '@blankcode/shared'
import { and, desc, eq } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { BadRequestError, InvalidTransitionError, NotFoundError } from '../../api/errors.js'

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['running', 'error'],
  running: ['passed', 'failed', 'error'],
}

interface SubmissionsServiceShape {
  readonly create: (
    userId: string,
    input: SubmissionCreateInput
  ) => Effect.Effect<any, NotFoundError | BadRequestError>
  readonly createAndExecute: (
    userId: string,
    input: SubmissionCreateInput
  ) => Effect.Effect<any, NotFoundError | BadRequestError>
  readonly findById: (id: string, userId?: string) => Effect.Effect<any, NotFoundError>
  readonly findByExercise: (
    exerciseId: string,
    userId: string
  ) => Effect.Effect<any[], NotFoundError>
  readonly findByUser: (
    userId: string,
    limit?: number,
    offset?: number
  ) => Effect.Effect<any[], NotFoundError>
  readonly retry: (
    id: string,
    userId: string
  ) => Effect.Effect<any, NotFoundError | BadRequestError>
  readonly updateStatus: (
    id: string,
    status: 'running' | 'passed' | 'failed' | 'error',
    testResults?: Array<{
      name: string
      passed: boolean
      message: string | null
      duration: number
    }>,
    executionTimeMs?: number,
    errorMessage?: string
  ) => Effect.Effect<any, NotFoundError | BadRequestError | InvalidTransitionError>
}

export class SubmissionsService extends Context.Tag('SubmissionsService')<
  SubmissionsService,
  SubmissionsServiceShape
>() {}

export const SubmissionsServiceLive = Layer.effect(
  SubmissionsService,
  Effect.gen(function* () {
    const db = yield* Drizzle

    return SubmissionsService.of({
      create: (userId, input) =>
        Effect.gen(function* () {
          const exercise = yield* Effect.tryPromise({
            try: () => db.query.exercises.findFirst({ where: eq(exercises.id, input.exerciseId) }),
            catch: () => new NotFoundError({ resource: 'Exercise', id: input.exerciseId }),
          })

          if (!exercise || !exercise.isPublished) {
            return yield* Effect.fail(
              new NotFoundError({ resource: 'Exercise', id: input.exerciseId })
            )
          }

          const submission = yield* Effect.tryPromise({
            try: async () => {
              const result = await db
                .insert(submissions)
                .values({
                  userId,
                  exerciseId: input.exerciseId,
                  code: input.code,
                  status: 'pending',
                })
                .returning()
              return result[0]
            },
            catch: () => new BadRequestError({ message: 'Failed to create submission' }),
          })

          if (!submission) {
            return yield* Effect.fail(
              new BadRequestError({ message: 'Failed to create submission' })
            )
          }

          return submission
        }),

      createAndExecute: (userId, input) =>
        Effect.gen(function* () {
          const exercise = yield* Effect.tryPromise({
            try: () => db.query.exercises.findFirst({ where: eq(exercises.id, input.exerciseId) }),
            catch: () => new NotFoundError({ resource: 'Exercise', id: input.exerciseId }),
          })

          if (!exercise || !exercise.isPublished) {
            return yield* Effect.fail(
              new NotFoundError({ resource: 'Exercise', id: input.exerciseId })
            )
          }

          const submission = yield* Effect.tryPromise({
            try: async () => {
              const result = await db
                .insert(submissions)
                .values({
                  userId,
                  exerciseId: input.exerciseId,
                  code: input.code,
                  status: 'pending',
                })
                .returning()
              return result[0]
            },
            catch: () => new BadRequestError({ message: 'Failed to create submission' }),
          })

          if (!submission) {
            return yield* Effect.fail(
              new BadRequestError({ message: 'Failed to create submission' })
            )
          }

          return submission
        }),

      findById: (id, userId?) =>
        Effect.gen(function* () {
          const submission = yield* Effect.tryPromise({
            try: () =>
              db.query.submissions.findFirst({
                where: userId
                  ? and(eq(submissions.id, id), eq(submissions.userId, userId))
                  : eq(submissions.id, id),
                with: { exercise: true },
              }),
            catch: () => new NotFoundError({ resource: 'Submission', id }),
          })

          if (!submission) {
            return yield* Effect.fail(new NotFoundError({ resource: 'Submission', id }))
          }

          return submission
        }),

      findByExercise: (exerciseId, userId) =>
        Effect.tryPromise({
          try: () =>
            db.query.submissions.findMany({
              where: and(eq(submissions.exerciseId, exerciseId), eq(submissions.userId, userId)),
              orderBy: desc(submissions.createdAt),
            }),
          catch: () => new NotFoundError({ resource: 'Submissions', id: exerciseId }),
        }),

      findByUser: (userId, limit = 20, offset = 0) =>
        Effect.tryPromise({
          try: () =>
            db.query.submissions.findMany({
              where: eq(submissions.userId, userId),
              orderBy: desc(submissions.createdAt),
              limit,
              offset,
              with: { exercise: true },
            }),
          catch: () => new NotFoundError({ resource: 'Submissions', id: userId }),
        }),

      retry: (id, userId) =>
        Effect.gen(function* () {
          const submission = yield* Effect.tryPromise({
            try: () =>
              db.query.submissions.findFirst({
                where: and(eq(submissions.id, id), eq(submissions.userId, userId)),
                with: { exercise: true },
              }),
            catch: () => new NotFoundError({ resource: 'Submission', id }),
          })

          if (!submission) {
            return yield* Effect.fail(new NotFoundError({ resource: 'Submission', id }))
          }

          if (submission.status !== 'error' && submission.status !== 'failed') {
            return yield* Effect.fail(
              new BadRequestError({ message: 'Can only retry failed or errored submissions' })
            )
          }

          yield* Effect.tryPromise({
            try: () =>
              db
                .update(submissions)
                .set({ status: 'pending', updatedAt: new Date() })
                .where(eq(submissions.id, id)),
            catch: () => new BadRequestError({ message: 'Failed to update submission status' }),
          })

          return { ...submission, status: 'pending' as const }
        }),

      updateStatus: (id, status, testResults?, executionTimeMs?, errorMessage?) =>
        Effect.gen(function* () {
          const existing = yield* Effect.tryPromise({
            try: () =>
              db.query.submissions.findFirst({
                where: eq(submissions.id, id),
                columns: { status: true },
              }),
            catch: () => new NotFoundError({ resource: 'Submission', id }),
          })

          if (!existing) {
            return yield* Effect.fail(new NotFoundError({ resource: 'Submission', id }))
          }

          const currentStatus = existing.status
          const allowedTransitions = VALID_TRANSITIONS[currentStatus]
          if (allowedTransitions && !allowedTransitions.includes(status)) {
            return yield* Effect.fail(
              new InvalidTransitionError({ from: currentStatus, to: status })
            )
          }

          const [submission] = yield* Effect.tryPromise({
            try: () =>
              db
                .update(submissions)
                .set({
                  status,
                  testResults: testResults ?? null,
                  executionTimeMs: executionTimeMs ?? null,
                  ...(errorMessage !== undefined ? { errorMessage } : {}),
                  updatedAt: new Date(),
                })
                .where(eq(submissions.id, id))
                .returning(),
            catch: () => new BadRequestError({ message: 'Failed to update submission status' }),
          })

          return submission
        }),
    })
  })
)
