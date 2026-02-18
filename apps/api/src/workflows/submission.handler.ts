import { Drizzle } from '@blankcode/db/client'
import * as schema from '@blankcode/db/schema'
import { eq } from 'drizzle-orm'
import { Duration, Effect } from 'effect'
import { config } from '../config/index.js'
import { executionService } from '../services/execution/index.js'
import type { ExecutionResult } from '../services/execution/types.js'
import { SubmissionWorkflow } from './submission.workflow.js'

export const SubmissionWorkflowLive = SubmissionWorkflow.toLayer((payload) =>
  Effect.gen(function* () {
    const db = yield* Drizzle
    const { submissionId, exerciseId, code } = payload

    yield* Effect.tryPromise({
      try: () =>
        db
          .update(schema.submissions)
          .set({ status: 'running', updatedAt: new Date() })
          .where(eq(schema.submissions.id, submissionId)),
      catch: () => undefined,
    })

    const exercise = yield* Effect.tryPromise({
      try: () =>
        db.query.exercises.findFirst({
          where: eq(schema.exercises.id, exerciseId),
        }),
      catch: () => undefined,
    })

    if (!exercise) {
      yield* Effect.tryPromise({
        try: () =>
          db
            .update(schema.submissions)
            .set({
              status: 'error',
              errorMessage: `Exercise not found: ${exerciseId}`,
              updatedAt: new Date(),
            })
            .where(eq(schema.submissions.id, submissionId)),
        catch: () => undefined,
      }).pipe(Effect.catchAll(() => Effect.succeed(undefined)))

      return {
        status: 'error' as const,
        testResults: [] as unknown[],
        executionTimeMs: null,
        errorMessage: `Exercise not found: ${exerciseId}`,
      }
    }

    const errorResult: ExecutionResult = {
      success: false,
      status: 'error',
      testResults: [],
      executionTimeMs: 0,
    }

    const result: ExecutionResult = yield* Effect.tryPromise({
      try: () =>
        executionService.execute(submissionId, exerciseId, code, exercise.testCode, 'typescript'),
      catch: (e) => ({ ...errorResult, errorMessage: String(e) }),
    }).pipe(
      Effect.timeout(Duration.millis(config.execution.timeoutMs + 5000)),
      Effect.catchTag('TimeoutException', () =>
        Effect.succeed<ExecutionResult>({
          ...errorResult,
          errorMessage: 'Execution timed out',
          executionTimeMs: config.execution.timeoutMs,
        })
      ),
      Effect.catchAll((e) =>
        Effect.succeed<ExecutionResult>({
          ...errorResult,
          errorMessage: String(e),
        })
      )
    )

    yield* Effect.tryPromise({
      try: () =>
        db
          .update(schema.submissions)
          .set({
            status: result.status,
            testResults: result.testResults ?? [],
            executionTimeMs: result.executionTimeMs ?? null,
            errorMessage: result.errorMessage ?? null,
            updatedAt: new Date(),
          })
          .where(eq(schema.submissions.id, submissionId)),
      catch: () => undefined,
    }).pipe(Effect.catchAll(() => Effect.succeed(undefined)))

    return {
      status: result.status,
      testResults: result.testResults ?? [],
      executionTimeMs: result.executionTimeMs ?? null,
      errorMessage: result.errorMessage,
    }
  }).pipe(
    Effect.catchAll((err) =>
      Effect.gen(function* () {
        const db = yield* Drizzle
        yield* Effect.tryPromise({
          try: () =>
            db
              .update(schema.submissions)
              .set({
                status: 'error',
                errorMessage: String(err),
                updatedAt: new Date(),
              })
              .where(eq(schema.submissions.id, payload.submissionId)),
          catch: () => undefined,
        }).pipe(Effect.catchAll(() => Effect.succeed(undefined)))

        return {
          status: 'error' as const,
          testResults: [] as unknown[],
          executionTimeMs: null,
          errorMessage: String(err),
        }
      })
    )
  )
)
