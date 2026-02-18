import { createDatabaseFromEnv } from '@blankcode/db/client'
import * as schema from '@blankcode/db/schema'
import { eq } from 'drizzle-orm'
import { executionService } from '../services/execution/index.js'
import type { ExecutionResult } from '../services/execution/types.js'

const POLL_INTERVAL_MS = 2000

async function markExerciseCompleted(
  db: ReturnType<typeof createDatabaseFromEnv>,
  userId: string,
  exerciseId: string,
  submissionId: string
) {
  try {
    await db
      .insert(schema.userProgress)
      .values({
        userId,
        exerciseId,
        isCompleted: true,
        attempts: 1,
        bestSubmissionId: submissionId,
        completedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [schema.userProgress.userId, schema.userProgress.exerciseId],
        set: {
          isCompleted: true,
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      })
  } catch (_err) {}
}

async function incrementAttempts(
  db: ReturnType<typeof createDatabaseFromEnv>,
  userId: string,
  exerciseId: string
) {
  try {
    await db
      .insert(schema.userProgress)
      .values({ userId, exerciseId, isCompleted: false, attempts: 1 })
      .onConflictDoUpdate({
        target: [schema.userProgress.userId, schema.userProgress.exerciseId],
        set: { updatedAt: new Date() },
      })
  } catch (_err) {}
}

async function processSubmission(
  db: ReturnType<typeof createDatabaseFromEnv>,
  submissionId: string
) {
  const submission = await db.query.submissions.findFirst({
    where: eq(schema.submissions.id, submissionId),
  })

  if (!submission) {
    return
  }

  if (submission.status !== 'pending') {
    return
  }

  // Set to running
  await db
    .update(schema.submissions)
    .set({ status: 'running', updatedAt: new Date() })
    .where(eq(schema.submissions.id, submissionId))

  try {
    // Fetch exercise
    const exercise = await db.query.exercises.findFirst({
      where: eq(schema.exercises.id, submission.exerciseId),
    })

    if (!exercise) {
      await db
        .update(schema.submissions)
        .set({
          status: 'error',
          errorMessage: `Exercise not found: ${submission.exerciseId}`,
          updatedAt: new Date(),
        })
        .where(eq(schema.submissions.id, submissionId))
      return
    }

    // Execute code
    const result: ExecutionResult = await executionService.execute(
      submissionId,
      submission.exerciseId,
      submission.code,
      exercise.testCode,
      'typescript'
    )

    // Save results
    await db
      .update(schema.submissions)
      .set({
        status: result.status,
        testResults: result.testResults ?? [],
        executionTimeMs: result.executionTimeMs ?? null,
        errorMessage: result.errorMessage ?? null,
        updatedAt: new Date(),
      })
      .where(eq(schema.submissions.id, submissionId))

    // Update progress based on result
    if (result.status === 'passed') {
      await markExerciseCompleted(db, submission.userId, submission.exerciseId, submissionId)
    } else if (result.status === 'failed') {
      await incrementAttempts(db, submission.userId, submission.exerciseId)
    }
  } catch (err) {
    await db
      .update(schema.submissions)
      .set({
        status: 'error',
        errorMessage: String(err),
        updatedAt: new Date(),
      })
      .where(eq(schema.submissions.id, submissionId))
  }
}

async function pollForSubmissions() {
  const db = createDatabaseFromEnv()

  while (true) {
    try {
      const pendingSubmissions = await db.query.submissions.findMany({
        where: eq(schema.submissions.status, 'pending'),
        orderBy: (submissions, { asc }) => [asc(submissions.createdAt)],
        limit: 5,
      })

      if (pendingSubmissions.length > 0) {
      }

      for (const submission of pendingSubmissions) {
        await processSubmission(db, submission.id)
      }
    } catch (_err) {}

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

pollForSubmissions()
