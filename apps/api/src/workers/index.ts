import { spawn } from 'node:child_process'
import { open, utimes } from 'node:fs/promises'
import { createDatabaseFromEnv } from '@blankcode/db/client'
import * as schema from '@blankcode/db/schema'
import { and, eq, sql } from 'drizzle-orm'
import { config } from '../config/index.js'
import { executionService } from '../services/execution/index.js'
import { logger } from '../services/execution/logger.js'
import type { ExecutionResult } from '../services/execution/types.js'

const POLL_INTERVAL_MS = 2000
const CLAIM_BATCH_SIZE = 10
const MAX_CONCURRENT = Number(process.env['WORKER_CONCURRENCY'] ?? 4)
const HEALTH_FILE = '/tmp/worker-healthy'
const SHUTDOWN_DEADLINE_MS = 25_000
// Lease window after which a 'running' row is considered crashed.
// Must be comfortably larger than EXECUTION_TIMEOUT_MS + container startup.
const REAP_AFTER_INTERVAL = '5 minutes'
const HEARTBEAT_INTERVAL_MS = 30_000
const MAX_ATTEMPTS = 1

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
  } catch (err) {
    logger.warn('scheduleReview failed', {
      userId,
      exerciseId,
      err: String(err),
    })
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
  } catch (err) {
    logger.warn('markExerciseCompleted failed', {
      submissionId,
      userId,
      exerciseId,
      err: String(err),
    })
  }
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
  } catch (err) {
    logger.warn('incrementAttempts failed', {
      userId,
      exerciseId,
      err: String(err),
    })
  }
}

interface ClaimedSubmission {
  id: string
  user_id: string
  exercise_id: string
  code: string
}

async function claimPendingSubmissions(
  db: ReturnType<typeof createDatabaseFromEnv>,
  limit: number
): Promise<ClaimedSubmission[]> {
  if (limit <= 0) return []
  // Atomic claim: SKIP LOCKED prevents two workers from picking the same row,
  // and the same statement flips status to 'running' so a later worker won't see it.
  const claimed = await db.execute(sql`
    UPDATE submissions
    SET status = 'running', updated_at = NOW()
    WHERE id IN (
      SELECT id FROM submissions
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, user_id, exercise_id, code
  `)
  return claimed.rows as unknown as ClaimedSubmission[]
}

interface ReapedRow {
  id: string
  status: 'pending' | 'error'
  attempt_count: number
}

// Reclaim 'running' rows orphaned by a crashed worker. Rows with attempts
// remaining go back to 'pending' for retry; exhausted ones land in 'error'.
async function reapStuckSubmissions(
  db: ReturnType<typeof createDatabaseFromEnv>
): Promise<ReapedRow[]> {
  const result = await db.execute(sql`
    UPDATE submissions
    SET
      status = CASE
        WHEN attempt_count < ${MAX_ATTEMPTS} THEN 'pending'::submission_status
        ELSE 'error'::submission_status
      END,
      attempt_count = attempt_count + 1,
      error_message = CASE
        WHEN attempt_count < ${MAX_ATTEMPTS} THEN error_message
        ELSE 'Worker crashed mid-execution (lease expired)'
      END,
      updated_at = NOW()
    WHERE id IN (
      SELECT id FROM submissions
      WHERE status = 'running'
        AND updated_at < NOW() - (${REAP_AFTER_INTERVAL})::interval
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, status, attempt_count
  `)
  return result.rows as unknown as ReapedRow[]
}

function startHeartbeat(
  db: ReturnType<typeof createDatabaseFromEnv>,
  submissionId: string
): NodeJS.Timeout {
  return setInterval(() => {
    db.update(schema.submissions)
      .set({ updatedAt: new Date() })
      .where(eq(schema.submissions.id, submissionId))
      .catch((err) => {
        logger.warn('heartbeat tick failed', { submissionId, err: String(err) })
      })
  }, HEARTBEAT_INTERVAL_MS)
}

async function processSubmission(
  db: ReturnType<typeof createDatabaseFromEnv>,
  submission: ClaimedSubmission
) {
  const submissionId = submission.id
  const startedAt = Date.now()

  try {
    const exercise = await db.query.exercises.findFirst({
      where: eq(schema.exercises.id, submission.exercise_id),
      with: { concept: { with: { track: true } } },
    })

    if (!exercise) {
      await db
        .update(schema.submissions)
        .set({
          status: 'error',
          errorMessage: `Exercise not found: ${submission.exercise_id}`,
          updatedAt: new Date(),
        })
        .where(eq(schema.submissions.id, submissionId))
      logger.warn('submission referenced missing exercise', {
        submissionId,
        exerciseId: submission.exercise_id,
      })
      return
    }

    const language = exercise.concept.track.slug
    logger.info('process.start', { submissionId, language })

    const heartbeat = startHeartbeat(db, submissionId)
    let result: ExecutionResult
    try {
      result = await executionService.execute(
        submissionId,
        submission.exercise_id,
        submission.code,
        exercise.testCode,
        language
      )
    } finally {
      clearInterval(heartbeat)
    }

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
      await markExerciseCompleted(db, submission.user_id, submission.exercise_id, submissionId)
      await scheduleReview(db, submission.user_id, submission.exercise_id, true)
    } else if (result.status === 'failed') {
      await incrementAttempts(db, submission.user_id, submission.exercise_id)
      await scheduleReview(db, submission.user_id, submission.exercise_id, false)
    }

    logger.info('process.end', {
      submissionId,
      language,
      status: result.status,
      durationMs: Date.now() - startedAt,
    })
  } catch (err) {
    logger.error('process.error', {
      submissionId,
      err: String(err),
      durationMs: Date.now() - startedAt,
    })
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

async function runWithLimit(
  db: ReturnType<typeof createDatabaseFromEnv>,
  items: ClaimedSubmission[],
  inflight: Set<Promise<void>>
): Promise<void> {
  if (items.length === 0) return
  let cursor = 0
  const workers = Array.from({ length: Math.min(MAX_CONCURRENT, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++]
      if (!item) break
      const promise = processSubmission(db, item).finally(() => {
        inflight.delete(promise)
      })
      inflight.add(promise)
      await promise
    }
  })
  await Promise.all(workers)
}

async function touchHealth(): Promise<void> {
  try {
    await utimes(HEALTH_FILE, new Date(), new Date())
  } catch {
    try {
      const handle = await open(HEALTH_FILE, 'w')
      await handle.close()
    } catch (err) {
      logger.warn('failed to touch health file', { err: String(err) })
    }
  }
}

function dockerImageInspect(image: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('docker', ['image', 'inspect', image], { stdio: 'ignore' })
    proc.on('error', () => resolve(false))
    proc.on('close', (code) => resolve(code === 0))
  })
}

async function checkRunnerImages(): Promise<void> {
  const images = Array.from(new Set(Object.values(config.execution.images)))
  logger.info('checking runner images', { count: images.length })

  const missing: string[] = []
  for (const image of images) {
    const ok = await dockerImageInspect(image)
    if (!ok) missing.push(image)
  }

  if (missing.length > 0) {
    logger.error(
      'FATAL: missing runner images. Run `docker compose build runner-images && docker compose up runner-images` to build them.',
      { missing }
    )
    process.exit(1)
  }
  logger.info('runner images present', { images })
}

async function pollForSubmissions(
  db: ReturnType<typeof createDatabaseFromEnv>,
  state: { running: boolean; inflight: Set<Promise<void>> }
) {
  while (state.running) {
    try {
      const reaped = await reapStuckSubmissions(db)
      if (reaped.length > 0) {
        const requeued = reaped.filter((r) => r.status === 'pending').length
        const errored = reaped.length - requeued
        logger.warn('reap', { total: reaped.length, requeued, errored })
      }

      const free = MAX_CONCURRENT - state.inflight.size
      const limit = Math.min(CLAIM_BATCH_SIZE, free)
      const claimed = await claimPendingSubmissions(db, limit)
      if (claimed.length > 0) {
        logger.info('claim', { count: claimed.length })
      }
      await runWithLimit(db, claimed, state.inflight)
      await touchHealth()
    } catch (err) {
      logger.error('poll error', { err: String(err) })
    }

    if (!state.running) break
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

async function main() {
  if (config.execution.dockerEnabled) {
    await checkRunnerImages()
  } else {
    logger.info('docker disabled — skipping runner image check')
  }

  const db = createDatabaseFromEnv()
  const state = {
    running: true,
    inflight: new Set<Promise<void>>(),
  }

  const shutdown = async (signal: string) => {
    if (!state.running) return
    state.running = false
    logger.info('shutdown begin', { signal, inflight: state.inflight.size })
    const deadline = new Promise<void>((resolve) => setTimeout(resolve, SHUTDOWN_DEADLINE_MS))
    await Promise.race([Promise.allSettled(state.inflight), deadline])
    logger.info('shutdown done', { remaining: state.inflight.size })
    process.exit(0)
  }

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM')
  })
  process.on('SIGINT', () => {
    void shutdown('SIGINT')
  })

  logger.info('worker started', {
    concurrency: MAX_CONCURRENT,
    batchSize: CLAIM_BATCH_SIZE,
    pollMs: POLL_INTERVAL_MS,
  })
  await touchHealth()
  await pollForSubmissions(db, state)
}

main().catch((err) => {
  logger.error('worker fatal', { err: String(err) })
  process.exit(1)
})
