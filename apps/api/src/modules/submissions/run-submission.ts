import * as schema from '@blankcode/db/schema'
import type { PgRemoteDatabase } from 'drizzle-orm/pg-proxy'
import { and, eq } from 'drizzle-orm'
import { executionService } from '../../services/execution/index.js'
import { logger } from '../../services/execution/logger.js'

/**
 * Runs a submission and records everything that follows from the result:
 * the verdict on the row, completion/mastery, and the SM-2 review schedule.
 *
 * This used to live in a long-lived worker that polled Postgres every two
 * seconds. Execution takes 2-12s, comfortably inside a request, so the queue
 * and its polling existed only because a separate process had to find work.
 * Running it inline removes the worker, the poll loop, the lease/reaper
 * machinery, and the window where a crashed worker stranded rows in 'running'.
 */

type Db = PgRemoteDatabase<typeof schema>

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

async function scheduleReview(db: Db, userId: string, exerciseId: string, passed: boolean) {
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
  } catch (err) {
    logger.warn('scheduleReview failed', {
      userId,
      exerciseId,
      err: String(err),
    })
  }
}

async function markExerciseCompleted(
  db: Db,
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
  } catch (err) {
    logger.warn('markExerciseCompleted failed', {
      submissionId,
      userId,
      exerciseId,
      err: String(err),
    })
  }
}

async function incrementAttempts(db: Db, userId: string, exerciseId: string) {
  try {
    await db
      .insert(schema.userProgress)
      .values({ userId, exerciseId, isCompleted: false, attempts: 1 })
      .onConflictDoUpdate({
        target: [schema.userProgress.userId, schema.userProgress.exerciseId],
        set: { updatedAt: new Date() },
      })
  } catch (err) {
    logger.warn('incrementAttempts failed', {
      userId,
      exerciseId,
      err: String(err),
    })
  }
}

export interface SubmissionToRun {
  submissionId: string
  userId: string
  exerciseId: string
  code: string
  testCode: string
  language: string
}

/**
 * Executes the submission and writes the outcome. Never throws: a failure to
 * execute is itself a result the learner needs to see, so it lands on the row
 * as `error` rather than propagating as a 500.
 */
export async function runSubmission(db: Db, input: SubmissionToRun): Promise<void> {
  const startedAt = Date.now()
  const { submissionId, userId, exerciseId, code, testCode, language } = input

  try {
    await db
      .update(schema.submissions)
      .set({ status: 'running', updatedAt: new Date() })
      .where(eq(schema.submissions.id, submissionId))

    const result = await executionService.execute(
      submissionId,
      exerciseId,
      code,
      testCode,
      language
    )

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

    if (result.status === 'passed') {
      await markExerciseCompleted(db, userId, exerciseId, submissionId)
      await scheduleReview(db, userId, exerciseId, true)
    } else if (result.status === 'failed') {
      await incrementAttempts(db, userId, exerciseId)
      await scheduleReview(db, userId, exerciseId, false)
    }

    logger.info('submission.done', {
      submissionId,
      language,
      status: result.status,
      durationMs: Date.now() - startedAt,
    })
  } catch (error) {
    logger.error('submission.error', {
      submissionId,
      error: String(error),
      durationMs: Date.now() - startedAt,
    })
    await db
      .update(schema.submissions)
      .set({ status: 'error', errorMessage: String(error), updatedAt: new Date() })
      .where(eq(schema.submissions.id, submissionId))
      .catch(() => {})
  }
}
