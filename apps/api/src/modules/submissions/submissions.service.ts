import { codeDrafts, exercises, submissions } from '@blankcode/db/schema'
import type { SubmissionCreateInput } from '@blankcode/shared'
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { Queue } from 'bullmq'
import { and, desc, eq } from 'drizzle-orm'
import { type Database, DRIZZLE } from '../../database/drizzle.provider.js'
import { SUBMISSION_QUEUE } from '../../queue/queue.module.js'

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['running', 'error'],
  running: ['passed', 'failed', 'error'],
}

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name)

  constructor(
    @Inject(DRIZZLE) private db: Database,
    @Inject(SUBMISSION_QUEUE) private submissionQueue: Queue
  ) {}

  async create(userId: string, input: SubmissionCreateInput) {
    const submission = await this.db.transaction(async (tx) => {
      const exercise = await tx.query.exercises.findFirst({
        where: eq(exercises.id, input.exerciseId),
      })
      if (!exercise) {
        throw new NotFoundException('Exercise not found')
      }

      if (!exercise.isPublished) {
        throw new NotFoundException('Exercise not found')
      }

      const [created] = await tx
        .insert(submissions)
        .values({
          userId,
          exerciseId: input.exerciseId,
          code: input.code,
          status: 'pending',
        })
        .returning()

      await tx
        .delete(codeDrafts)
        .where(and(eq(codeDrafts.userId, userId), eq(codeDrafts.exerciseId, input.exerciseId)))

      return created
    })

    try {
      await this.submissionQueue.add(
        'execute',
        {
          submissionId: submission?.id,
          exerciseId: input.exerciseId,
          code: input.code,
        },
        {
          jobId: `submission-${submission!.id}`,
        }
      )
    } catch (err) {
      this.logger.error(`Failed to enqueue submission ${submission?.id}`, err)
      await this.db
        .update(submissions)
        .set({ status: 'error', errorMessage: 'Failed to enqueue submission' })
        .where(eq(submissions.id, submission!.id))
    }

    return submission
  }

  async findById(id: string, userId?: string) {
    const submission = await this.db.query.submissions.findFirst({
      where: userId
        ? and(eq(submissions.id, id), eq(submissions.userId, userId))
        : eq(submissions.id, id),
      with: {
        exercise: true,
      },
    })

    if (!submission) {
      throw new NotFoundException('Submission not found')
    }

    return submission
  }

  async findByExercise(exerciseId: string, userId: string) {
    return this.db.query.submissions.findMany({
      where: and(eq(submissions.exerciseId, exerciseId), eq(submissions.userId, userId)),
      orderBy: desc(submissions.createdAt),
    })
  }

  async findByUser(userId: string, limit = 20, offset = 0) {
    return this.db.query.submissions.findMany({
      where: eq(submissions.userId, userId),
      orderBy: desc(submissions.createdAt),
      limit,
      offset,
      with: {
        exercise: true,
      },
    })
  }

  async retry(id: string, userId: string) {
    const submission = await this.findById(id, userId)

    if (submission.status !== 'error' && submission.status !== 'failed') {
      throw new BadRequestException('Can only retry failed or errored submissions')
    }

    await this.db.update(submissions).set({ status: 'pending' }).where(eq(submissions.id, id))

    await this.submissionQueue.add(
      'execute',
      {
        submissionId: submission.id,
        exerciseId: submission.exerciseId,
        code: submission.code,
      },
      {
        jobId: `submission-${submission.id}-retry-${Date.now()}`,
      }
    )

    return { ...submission, status: 'pending' as const }
  }

  async updateStatus(
    id: string,
    status: 'running' | 'passed' | 'failed' | 'error',
    testResults?: Array<{
      name: string
      passed: boolean
      message: string | null
      duration: number
    }>,
    executionTimeMs?: number
  ) {
    const existing = await this.db.query.submissions.findFirst({
      where: eq(submissions.id, id),
      columns: { status: true },
    })

    if (existing) {
      const currentStatus = existing.status
      const allowedTransitions = VALID_TRANSITIONS[currentStatus]
      if (allowedTransitions && !allowedTransitions.includes(status)) {
        throw new BadRequestException(
          `Invalid status transition from '${currentStatus}' to '${status}'`
        )
      }
    }

    const [submission] = await this.db
      .update(submissions)
      .set({
        status,
        testResults: testResults ?? null,
        executionTimeMs: executionTimeMs ?? null,
      })
      .where(eq(submissions.id, id))
      .returning()

    return submission
  }
}
