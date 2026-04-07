import { createDatabaseFromEnv } from '@blankcode/db/client'
import * as schema from '@blankcode/db/schema'
import { and, eq } from 'drizzle-orm'
import { executionService } from '../services/execution/index.js'
import type { ExecutionResult } from '../services/execution/types.js'

const POLL_INTERVAL_MS = 2000

type ReviewQuality = 0 | 1 | 2 | 3 | 4 | 5

interface SM2Result {
  intervalDays: number
  repetitions: number
  easeFactor: number
  nextReviewAt: Date
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function calculateNextReview(
  quality: ReviewQuality,
  currentInterval: number,
  currentRepetitions: number,
  currentEaseFactor: number
): SM2Result {
  if (quality < 3) {
    return {
      intervalDays: 1,
      repetitions: 0,
      easeFactor: Math.max(1.3, currentEaseFactor - 0.2),
      nextReviewAt: addDays(new Date(), 1),
    }
  }

  const newEaseFactor = Math.max(
    1.3,
    currentEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  )

  let intervalDays: number
  if (currentRepetitions === 0) {
    intervalDays = 1
  } else if (currentRepetitions === 1) {
    intervalDays = 3
  } else {
    intervalDays = Math.round(currentInterval * newEaseFactor)
  }

  if (quality === 3) intervalDays = Math.round(intervalDays * 0.8)
  if (quality === 5) intervalDays = Math.round(intervalDays * 1.3)

  return {
    intervalDays,
    repetitions: currentRepetitions + 1,
    easeFactor: newEaseFactor,
    nextReviewAt: addDays(new Date(), intervalDays),
  }
}

async function scheduleReview(
  db: ReturnType<typeof createDatabaseFromEnv>,
  userId: string,
  exerciseId: string,
  passed: boolean
) {
  try {
    const existingSchedule = await db.query.reviewSchedules.findFirst({
      where: and(
        eq(schema.reviewSchedules.userId, userId),
        eq(schema.reviewSchedules.exerciseId, exerciseId)
      ),
    })

    const quality: ReviewQuality = passed ? 4 : 1
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
      await db
        .update(schema.reviewSchedules)
        .set({
          intervalDays: result.intervalDays,
          repetitions: result.repetitions,
          easeFactor: result.easeFactor,
          nextReviewAt: result.nextReviewAt,
          lastReviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.reviewSchedules.id, existingSchedule.id))
    } else {
      await db.insert(schema.reviewSchedules).values({
        userId,
        exerciseId,
        intervalDays: result.intervalDays,
        repetitions: result.repetitions,
        easeFactor: result.easeFactor,
        nextReviewAt: result.nextReviewAt,
        lastReviewedAt: new Date(),
      })
    }
  } catch (_err) {
    // Fire-and-forget: if SR scheduling fails, submission should still succeed
  }
}

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
      await scheduleReview(db, submission.userId, submission.exerciseId, true)
    } else if (result.status === 'failed') {
      await incrementAttempts(db, submission.userId, submission.exerciseId)
      await scheduleReview(db, submission.userId, submission.exerciseId, false)
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
