import { Drizzle } from '@blankcode/db/client'
import { exercises, submissions, users } from '@blankcode/db/schema'
import type { SubmissionCreateInput } from '@blankcode/shared'
import { and, count, desc, eq, gte } from 'drizzle-orm'
import { type BlankRegionInStarter, gradeBlanks, limitsFor, mayUse } from '@blankcode/shared'
import { Context, Effect, Layer } from 'effect'
import { BadRequestError, InvalidTransitionError, NotFoundError } from '../../api/errors.js'
import { redactExercise } from '../exercises/redact.js'
import { runSubmission } from './run-submission.js'

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['running', 'error'],
  running: ['passed', 'failed', 'error'],
}

/** A submission row exactly as the table defines it. */
export type SubmissionRow = typeof submissions.$inferSelect

/**
 * What the service actually hands back.
 *
 * The interface used to say `any` for every one of these, which meant the
 * contract promised nothing: a handler could read a field that does not exist
 * and nothing would object until a user saw the undefined.
 *
 * `exercise` is present only on the reads that join it, and always redacted —
 * `redactExercise` strips `solutionCode` and the blanks' answers, so the type
 * is deliberately loose about its shape rather than claiming to be the full
 * exercise row it is not.
 */
export interface SubmissionWithFeedback extends SubmissionRow {
  blankFeedback: ReturnType<typeof gradeBlanks> | null
  // Required, not optional: every read that returns this type joins the
  // exercise. `exactOptionalPropertyTypes` makes the distinction real, and
  // claiming it might be absent would push a needless check onto every caller.
  exercise: Record<string, unknown>
}

interface SubmissionsServiceShape {
  readonly create: (
    userId: string,
    input: SubmissionCreateInput
  ) => Effect.Effect<SubmissionRow, NotFoundError | BadRequestError>
  readonly createAndExecute: (
    userId: string,
    input: SubmissionCreateInput
  ) => Effect.Effect<SubmissionRow | SubmissionWithFeedback, NotFoundError | BadRequestError>
  readonly findById: (
    id: string,
    userId?: string
  ) => Effect.Effect<SubmissionWithFeedback, NotFoundError>
  /** No exercise join, so nothing to redact and no blanks to grade. */
  readonly findByExercise: (
    exerciseId: string,
    userId: string
  ) => Effect.Effect<SubmissionRow[], NotFoundError>
  readonly findByUser: (
    userId: string,
    limit?: number,
    offset?: number
  ) => Effect.Effect<SubmissionWithFeedback[], NotFoundError>
  readonly retry: (
    id: string,
    userId: string
  ) => Effect.Effect<SubmissionRow, NotFoundError | BadRequestError>
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
  ) => Effect.Effect<SubmissionRow, NotFoundError | BadRequestError | InvalidTransitionError>
}

export class SubmissionsService extends Context.Tag('SubmissionsService')<
  SubmissionsService,
  SubmissionsServiceShape
>() {}

/**
 * Attaches per-blank verdicts to a finished submission and strips the answers
 * out of the embedded exercise.
 *
 * The browser used to grade blanks itself by comparing against
 * `blanks[].solution`, which meant the API had to ship every answer to every
 * client. Grading here keeps the answers server-side, and gating on a terminal
 * status stops the response from becoming an oracle you can poll before the
 * tests have run.
 */
function withBlankFeedback<T extends Record<string, any>>(submission: T) {
  const exercise = submission['exercise'] as
    | { starterCode?: string; blanks?: unknown; type?: string }
    | undefined

  const blanks = Array.isArray(exercise?.blanks)
    ? (exercise.blanks as (BlankRegionInStarter & { solution?: string })[])
    : []

  const isTerminal = submission['status'] !== 'pending' && submission['status'] !== 'running'

  const blankFeedback =
    isTerminal && blanks.length > 0 && exercise?.starterCode
      ? gradeBlanks(String(submission['code'] ?? ''), exercise.starterCode, blanks)
      : null

  return {
    ...submission,
    blankFeedback,
    ...(exercise ? { exercise: redactExercise(exercise as Record<string, unknown>) } : {}),
  }
}

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

          /*
           * The daily cap, checked before anything is written.
           *
           * A submission is the only part of this product with a real marginal
           * cost — each one boots a microVM — so this is where the free tier is
           * actually a tier. Counted from the submissions table rather than a
           * counter: the rows already carry a user and a timestamp, and a
           * second record of one fact eventually disagrees with the first.
           *
           * A failed count allows the request. This limits spend, not access,
           * and a database blip should not stop everyone from practising.
           */
          // Unreadable is not the same as absent: the caller is authenticated,
          // so the row exists. Failing the submission over a lookup that did
          // not answer would turn a database blip into "you cannot practise".
          const user = yield* Effect.tryPromise({
            try: () =>
              db.query.users.findFirst({
                where: eq(users.id, userId),
                columns: { subscriptionStatus: true, subscriptionEndsAt: true },
              }),
            catch: () => new Error('unreadable'),
          }).pipe(Effect.catchAll(() => Effect.succeed(undefined)))

          const limits = limitsFor(
            {
              subscriptionStatus: user?.subscriptionStatus ?? null,
              subscriptionEndsAt: user?.subscriptionEndsAt ?? null,
            },
            new Date()
          )

          if (!limits.paid) {
            const usedToday = yield* Effect.tryPromise({
              try: async () => {
                const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
                const [row] = await db
                  .select({ n: count() })
                  .from(submissions)
                  .where(and(eq(submissions.userId, userId), gte(submissions.createdAt, since)))
                return row?.n ?? 0
              },
              // Null, not zero: a caller has to be able to tell "used none"
              // from "could not count".
              catch: () => null,
            }).pipe(Effect.catchAll(() => Effect.succeed(null)))

            if (!mayUse(limits, 'submission', usedToday)) {
              return yield* Effect.fail(
                new BadRequestError({
                  message: `You have used today's ${limits.submissionsPerDay} free submissions. They reset 24 hours after each one.`,
                })
              )
            }
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

      /*
       * Creates the submission AND runs it, in the same request.
       *
       * The name used to be a lie: it only inserted a `pending` row and a
       * separate worker process polled for it. Execution takes 2-12s, which
       * fits inside a request everywhere this runs, so the queue bought
       * nothing but a poll loop, a lease reaper, and a class of bug where a
       * crashed worker stranded rows in `running`.
       */
      createAndExecute: (userId, input) =>
        Effect.gen(function* () {
          const exercise = yield* Effect.tryPromise({
            try: () =>
              db.query.exercises.findFirst({
                where: eq(exercises.id, input.exerciseId),
                with: { concept: { with: { track: true } } },
              }),
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

          // `runSubmission` records its own failures on the row, so the request
          // still returns a submission the client can render.
          yield* Effect.promise(() =>
            runSubmission(db, {
              submissionId: submission.id,
              userId,
              exerciseId: exercise.id,
              code: input.code,
              testCode: exercise.testCode,
              language: exercise.concept.track.slug,
            })
          )

          const finished = yield* Effect.tryPromise({
            try: () =>
              db.query.submissions.findFirst({
                where: eq(submissions.id, submission.id),
                with: { exercise: true },
              }),
            catch: () => new BadRequestError({ message: 'Failed to read submission' }),
          })

          return finished ? withBlankFeedback(finished) : submission
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

          return withBlankFeedback(submission)
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
          try: async () => {
            const rows = await db.query.submissions.findMany({
              where: eq(submissions.userId, userId),
              orderBy: desc(submissions.createdAt),
              limit,
              offset,
              with: { exercise: true },
            })
            // This join used to be returned untouched, so the submission list
            // shipped `solutionCode` and every blank's answer for each attempt.
            // The same leak was closed in the exercises service; this path was
            // missed, and `any` on the return type meant nothing pointed at it.
            return rows.map((row) => withBlankFeedback(row))
          },
          catch: () => new NotFoundError({ resource: 'Submissions', id: userId }),
        }),

      retry: (id, userId) =>
        Effect.gen(function* () {
          const submission = yield* Effect.tryPromise({
            try: () =>
              db.query.submissions.findFirst({
                where: and(eq(submissions.id, id), eq(submissions.userId, userId)),
                // No exercise join: this only reads `status`, and the joined
                // exercise was being spread into the response untouched —
                // shipping `solutionCode` and every blank's answer. Not
                // fetching it is a better fix than redacting it.
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

          // `.returning()` yields nothing when the row vanished between the
          // read above and this write. Returning `undefined` here would
          // serialise as an empty body with a 200, which reads as success.
          if (!submission) {
            return yield* Effect.fail(new NotFoundError({ resource: 'Submission', id }))
          }

          return submission
        }),
    })
  })
)
