import { Injectable, Inject } from '@nestjs/common'
import { Queue } from 'bullmq'
import { GENERATION_QUEUE } from '../../queue/queue.module.js'

export interface GenerateExerciseInput {
  trackSlug: string
  conceptSlug: string
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  topic?: string
}

@Injectable()
export class GenerationService {
  constructor(@Inject(GENERATION_QUEUE) private generationQueue: Queue) {}

  async queueExerciseGeneration(input: GenerateExerciseInput) {
    const job = await this.generationQueue.add('generate-exercise', input, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    })

    return {
      jobId: job.id,
      status: 'queued',
    }
  }

  async getJobStatus(jobId: string) {
    const job = await this.generationQueue.getJob(jobId)

    if (!job) {
      return null
    }

    const state = await job.getState()

    return {
      jobId: job.id,
      status: state,
      progress: job.progress,
      result: job.returnvalue,
      failedReason: job.failedReason,
    }
  }
}
