import * as schema from '@blankcode/db/schema'
import { type Job, Worker } from 'bullmq'
import { eq, sql as rawSql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { config } from '../config/index.js'
import { connection } from '../queue/queue.module.js'
import { executionService } from '../services/execution/index.js'
import type { SubmissionJobData } from '../services/execution/types.js'

const sql = postgres(config.database.url)
const db = drizzle(sql, { schema })

async function processSubmission(job: Job<SubmissionJobData>) {
  const { submissionId, exerciseId, code } = job.data

  // Update status to running
  await db
    .update(schema.submissions)
    .set({ status: 'running' })
    .where(eq(schema.submissions.id, submissionId))

  try {
    // Fetch exercise to get test code and language
    const exercise = await db.query.exercises.findFirst({
      where: eq(schema.exercises.id, exerciseId),
      with: {
        concept: {
          with: {
            track: true,
          },
        },
      },
    })

    if (!exercise) {
      await db
        .update(schema.submissions)
        .set({
          status: 'error',
          testResults: [],
          errorMessage: `Exercise not found: ${exerciseId}`,
        })
        .where(eq(schema.submissions.id, submissionId))
      return
    }

    const language = exercise.concept.track.slug

    // Execute the submission
    const result = await executionService.execute(
      submissionId,
      exerciseId,
      code,
      exercise.testCode,
      language
    )

    // Update submission with results
    await db
      .update(schema.submissions)
      .set({
        status: result.status,
        testResults: result.testResults,
        executionTimeMs: result.executionTimeMs,
        errorMessage: result.errorMessage ?? null,
      })
      .where(eq(schema.submissions.id, submissionId))

    // If passed, update progress
    if (result.status === 'passed') {
      const submission = await db.query.submissions.findFirst({
        where: eq(schema.submissions.id, submissionId),
      })

      if (submission) {
        await markExerciseCompleted(submission.userId, exerciseId, submissionId)
      }
    } else {
      // Just increment attempts for failed submissions
      const submission = await db.query.submissions.findFirst({
        where: eq(schema.submissions.id, submissionId),
      })

      if (submission) {
        await incrementAttempts(submission.userId, exerciseId)
      }
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'An unexpected error occurred during execution'

    await db
      .update(schema.submissions)
      .set({
        status: 'error',
        testResults: [],
        errorMessage,
      })
      .where(eq(schema.submissions.id, submissionId))
  }
}

async function markExerciseCompleted(userId: string, exerciseId: string, submissionId: string) {
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
        attempts: rawSql`${schema.userProgress.attempts} + 1`,
        bestSubmissionId: rawSql`CASE
          WHEN ${schema.userProgress.bestSubmissionId} IS NULL THEN ${submissionId}
          WHEN (SELECT execution_time_ms FROM submissions WHERE id = ${submissionId}) <
               (SELECT execution_time_ms FROM submissions WHERE id = ${schema.userProgress.bestSubmissionId})
          THEN ${submissionId}
          ELSE ${schema.userProgress.bestSubmissionId}
        END`,
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    })

  await updateConceptMastery(userId, exerciseId)
}

async function incrementAttempts(userId: string, exerciseId: string) {
  await db
    .insert(schema.userProgress)
    .values({
      userId,
      exerciseId,
      isCompleted: false,
      attempts: 1,
    })
    .onConflictDoUpdate({
      target: [schema.userProgress.userId, schema.userProgress.exerciseId],
      set: {
        attempts: rawSql`${schema.userProgress.attempts} + 1`,
        updatedAt: new Date(),
      },
    })
}

async function updateConceptMastery(userId: string, exerciseId: string) {
  const exercise = await db.query.exercises.findFirst({
    where: eq(schema.exercises.id, exerciseId),
    with: {
      concept: true,
    },
  })

  if (!exercise) return

  const conceptExercises = await db.query.exercises.findMany({
    where: eq(schema.exercises.conceptId, exercise.conceptId),
  })

  const completedProgress = await db.query.userProgress.findMany({
    where: (up, { and, eq }) => and(eq(up.userId, userId), eq(up.isCompleted, true)),
  })

  const completedExerciseIds = new Set(completedProgress.map((p) => p.exerciseId))
  const completedInConcept = conceptExercises.filter((e) => completedExerciseIds.has(e.id)).length

  const masteryLevel = completedInConcept / conceptExercises.length

  await db
    .insert(schema.conceptMastery)
    .values({
      userId,
      conceptId: exercise.conceptId,
      masteryLevel,
      exercisesCompleted: completedInConcept,
      exercisesTotal: conceptExercises.length,
      lastPracticedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [schema.conceptMastery.userId, schema.conceptMastery.conceptId],
      set: {
        masteryLevel,
        exercisesCompleted: completedInConcept,
        exercisesTotal: conceptExercises.length,
        lastPracticedAt: new Date(),
        updatedAt: new Date(),
      },
    })
}

export function createSubmissionWorker() {
  const worker = new Worker<SubmissionJobData>('submissions', processSubmission, {
    connection,
    concurrency: 5,
    lockDuration: 60000,
    stalledInterval: 30000,
  })

  worker.on('failed', async (job, err) => {
    if (job && job.attemptsMade >= (job.opts?.attempts ?? 3)) {
      await db
        .update(schema.submissions)
        .set({
          status: 'error',
          errorMessage: `Job failed after ${job.attemptsMade} attempts: ${err.message}`,
        })
        .where(eq(schema.submissions.id, job.data.submissionId))
    }
  })

  worker.on('stalled', (jobId) => {
    console.warn(`[Worker] Job ${jobId} stalled, will be retried`)
  })

  return worker
}
