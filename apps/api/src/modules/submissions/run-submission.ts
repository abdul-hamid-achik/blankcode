import * as schema from '@blankcode/db/schema'
import type { PgRemoteDatabase } from 'drizzle-orm/pg-proxy'
import { and, eq } from 'drizzle-orm'
import { holdForReflection } from '../reviews/scheduler.js'
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

async function scheduleReview(
  db: Db,
  userId: string,
  exerciseId: string,
  passed: boolean,
  awaitingReflection: boolean
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

    // An agent pass the human has not explained advances the SM-2 state but
    // not the schedule's trust: the date stays within a day and the full one
    // parks in heldNextReviewAt until a substantive reflection promotes it.
    // A human submission settles the question directly and clears any hold.
    const dates = awaitingReflection
      ? holdForReflection(result)
      : { nextReviewAt: result.nextReviewAt, heldNextReviewAt: null }

    if (existingSchedule) {
      await db
        .update(schema.reviewSchedules)
        .set({
          intervalDays: result.intervalDays,
          repetitions: result.repetitions,
          easeFactor: result.easeFactor,
          nextReviewAt: dates.nextReviewAt,
          heldNextReviewAt: dates.heldNextReviewAt,
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
        nextReviewAt: dates.nextReviewAt,
        heldNextReviewAt: dates.heldNextReviewAt,
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
  /** Which credential submitted. Defaults to the web session. */
  via?: 'web' | 'agent'
  /** The exercise's type, for the SM-2 gate below. */
  exerciseType?: string
}

/**
 * Whether this submission may move the review schedule.
 *
 * The scheduler models the learner's memory. For the vibecoding forms
 * (review, turn, context, spec, challenge) an agent submitting IS the
 * curriculum, so the schedule moves as usual. But a blank exercise is a
 * recall exercise — if an agent fills the blanks, the recall that happened
 * was the agent's, and advancing the human's schedule on it corrupts the one
 * model the product runs on. The attempt still counts and is labeled
 * `assisted`; the review simply stays owed until the human does it.
 */
export function shouldScheduleReview(
  via: 'web' | 'agent',
  exerciseType: string | undefined
): boolean {
  return via === 'web' || exerciseType !== 'blank'
}

/**
 * Executes the submission and writes the outcome. Never throws: a failure to
 * execute is itself a result the learner needs to see, so it lands on the row
 * as `error` rather than propagating as a 500.
 */
export async function runSubmission(db: Db, input: SubmissionToRun): Promise<void> {
  const startedAt = Date.now()
  const { submissionId, userId, exerciseId, code, testCode, language } = input
  const via = input.via ?? 'web'
  const movesSchedule = shouldScheduleReview(via, input.exerciseType)

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
      // An agent pass is held until the human explains it; a web pass is
      // the human's own work and needs no explanation to be believed.
      if (movesSchedule) await scheduleReview(db, userId, exerciseId, true, via === 'agent')
    } else if (result.status === 'failed') {
      await incrementAttempts(db, userId, exerciseId)
      // A failed agent attempt must not shorten the human's intervals either.
      if (movesSchedule) await scheduleReview(db, userId, exerciseId, false, false)
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
