import { runSubmission } from '@blankcode/api/run-submission'
import { createDatabaseFromEnv } from '@blankcode/db/client'
import { exercises, submissions } from '@blankcode/db/schema'
import { eq } from 'drizzle-orm'

/**
 * Runs a finished session's code against the exercise's real suite — VIA the
 * submission path, not beside it.
 *
 * This was a 501 for exactly one reason: wiring it needed a submission to be
 * created from session code rather than from the editor. That is what this
 * does. Going through a real submission row is the point, not a convenience:
 * the run lands in the learner's history, completion is marked, and the
 * review schedule moves — a session that passed is practice like any other,
 * and practice that bypasses the loop is invisible to it.
 */

export interface HiddenRunOutcome {
  passed: boolean
  testResults: Array<{ name: string; passed: boolean; message: string | null; duration: number }>
  errorMessage: string | null
}

/**
 * The runner the submit route passes to the session service: bound to the
 * user (the submission row needs an owner) and capturing the run's details,
 * so the response can say which tests failed rather than just that some did.
 */
export function makeHiddenRunner(
  userId: string,
  capture: { value?: HiddenRunOutcome }
): (code: string, exerciseId: string) => Promise<boolean> {
  return async (code, exerciseId) => {
    const db = createDatabaseFromEnv()

    const exercise = await db.query.exercises.findFirst({
      where: eq(exercises.id, exerciseId),
      with: { concept: { with: { track: true } } },
    })
    if (!exercise) {
      throw createError({ statusCode: 404, statusMessage: 'Exercise not found' })
    }

    const [row] = await db
      .insert(submissions)
      .values({
        userId,
        exerciseId,
        code,
        status: 'pending',
        // The human ran this session in the browser; 'web' is the truth.
        via: 'web',
      })
      .returning({ id: submissions.id })
    if (!row) {
      throw createError({ statusCode: 500, statusMessage: 'Could not create the submission' })
    }

    // Records its own failures on the row; never throws for a red suite.
    // The cast bridges two drizzle client flavours (node-pg here, pg-proxy in
    // the API's signature) that share the query surface runSubmission uses.
    await runSubmission(db as unknown as Parameters<typeof runSubmission>[0], {
      submissionId: row.id,
      userId,
      exerciseId,
      code,
      testCode: exercise.testCode,
      language: exercise.concept.track.slug,
      via: 'web',
      exerciseType: exercise.type,
    })

    const finished = await db.query.submissions.findFirst({
      where: eq(submissions.id, row.id),
      columns: { status: true, testResults: true, errorMessage: true },
    })

    capture.value = {
      passed: finished?.status === 'passed',
      testResults: finished?.testResults ?? [],
      errorMessage: finished?.errorMessage ?? null,
    }
    return capture.value.passed
  }
}
