import { Worker, type Job } from 'bullmq'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'
import { config } from '../config/index.js'
import { connection } from '../queue/queue.module.js'
import { executionService } from '../services/execution/index.js'
import type { SubmissionJobData } from '../services/execution/types.js'
import * as schema from '@blankcode/db/schema'

const sql = postgres(config.database.url)
const db = drizzle(sql, { schema })

async function processSubmission(job: Job<SubmissionJobData>) {
  const { submissionId, exerciseId, code } = job.data

  console.log(`[Worker] Processing submission ${submissionId}`)

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
      console.error(`[Worker] Exercise not found: ${exerciseId}`)
      await db
        .update(schema.submissions)
        .set({
          status: 'error',
          testResults: [],
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

    console.log(`[Worker] Submission ${submissionId} result: ${result.status}`)

    // Update submission with results
    await db
      .update(schema.submissions)
      .set({
        status: result.status,
        testResults: result.testResults,
        executionTimeMs: result.executionTimeMs,
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
    console.error(`[Worker] Error processing submission ${submissionId}:`, error)

    await db
      .update(schema.submissions)
      .set({
        status: 'error',
        testResults: [],
      })
      .where(eq(schema.submissions.id, submissionId))
  }
}

async function markExerciseCompleted(userId: string, exerciseId: string, submissionId: string) {
  const existing = await db.query.userProgress.findFirst({
    where: (up, { and, eq }) =>
      and(eq(up.userId, userId), eq(up.exerciseId, exerciseId)),
  })

  if (existing) {
    await db
      .update(schema.userProgress)
      .set({
        isCompleted: true,
        attempts: existing.attempts + 1,
        bestSubmissionId: submissionId,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.userProgress.id, existing.id))
  } else {
    await db.insert(schema.userProgress).values({
      userId,
      exerciseId,
      isCompleted: true,
      attempts: 1,
      bestSubmissionId: submissionId,
      completedAt: new Date(),
    })
  }

  await updateConceptMastery(userId, exerciseId)
}

async function incrementAttempts(userId: string, exerciseId: string) {
  const existing = await db.query.userProgress.findFirst({
    where: (up, { and, eq }) =>
      and(eq(up.userId, userId), eq(up.exerciseId, exerciseId)),
  })

  if (existing) {
    await db
      .update(schema.userProgress)
      .set({
        attempts: existing.attempts + 1,
        updatedAt: new Date(),
      })
      .where(eq(schema.userProgress.id, existing.id))
  } else {
    await db.insert(schema.userProgress).values({
      userId,
      exerciseId,
      isCompleted: false,
      attempts: 1,
    })
  }
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
    where: (up, { and, eq }) =>
      and(eq(up.userId, userId), eq(up.isCompleted, true)),
  })

  const completedExerciseIds = new Set(completedProgress.map((p) => p.exerciseId))
  const completedInConcept = conceptExercises.filter((e) =>
    completedExerciseIds.has(e.id)
  ).length

  const masteryLevel = completedInConcept / conceptExercises.length

  const existing = await db.query.conceptMastery.findFirst({
    where: (cm, { and, eq }) =>
      and(eq(cm.userId, userId), eq(cm.conceptId, exercise.conceptId)),
  })

  if (existing) {
    await db
      .update(schema.conceptMastery)
      .set({
        masteryLevel,
        exercisesCompleted: completedInConcept,
        exercisesTotal: conceptExercises.length,
        lastPracticedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.conceptMastery.id, existing.id))
  } else {
    await db.insert(schema.conceptMastery).values({
      userId,
      conceptId: exercise.conceptId,
      masteryLevel,
      exercisesCompleted: completedInConcept,
      exercisesTotal: conceptExercises.length,
      lastPracticedAt: new Date(),
    })
  }
}

export function createSubmissionWorker() {
  const worker = new Worker<SubmissionJobData>('submissions', processSubmission, {
    connection,
    concurrency: 5,
  })

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed`)
  })

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err)
  })

  worker.on('error', (err) => {
    console.error('[Worker] Worker error:', err)
  })

  return worker
}
