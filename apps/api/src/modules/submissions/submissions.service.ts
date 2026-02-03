import { Injectable, Inject, NotFoundException } from '@nestjs/common'
import { eq, and, desc } from 'drizzle-orm'
import { Queue } from 'bullmq'
import { DRIZZLE, type Database } from '../../database/drizzle.provider.js'
import { SUBMISSION_QUEUE } from '../../queue/queue.module.js'
import { submissions } from '@blankcode/db/schema'
import type { SubmissionCreateInput } from '@blankcode/shared'

@Injectable()
export class SubmissionsService {
  constructor(
    @Inject(DRIZZLE) private db: Database,
    @Inject(SUBMISSION_QUEUE) private submissionQueue: Queue
  ) {}

  async create(userId: string, input: SubmissionCreateInput) {
    const [submission] = await this.db
      .insert(submissions)
      .values({
        userId,
        exerciseId: input.exerciseId,
        code: input.code,
        status: 'pending',
      })
      .returning()

    await this.submissionQueue.add('execute', {
      submissionId: submission!.id,
      exerciseId: input.exerciseId,
      code: input.code,
    })

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

  async findByUser(userId: string, limit = 20) {
    return this.db.query.submissions.findMany({
      where: eq(submissions.userId, userId),
      orderBy: desc(submissions.createdAt),
      limit,
      with: {
        exercise: true,
      },
    })
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
