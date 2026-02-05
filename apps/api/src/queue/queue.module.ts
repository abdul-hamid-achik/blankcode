import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common'
import { type ConnectionOptions, Queue } from 'bullmq'
import { config } from '../config/index.js'

export const SUBMISSION_QUEUE = Symbol('SUBMISSION_QUEUE')
export const GENERATION_QUEUE = Symbol('GENERATION_QUEUE')
export const REDIS_CONNECTION = Symbol('REDIS_CONNECTION')

export const connection: ConnectionOptions = {
  host: config.redis.host,
  port: config.redis.port,
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CONNECTION,
      useValue: connection,
    },
    {
      provide: SUBMISSION_QUEUE,
      useFactory: () =>
        new Queue('submissions', {
          connection,
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: 100,
            removeOnFail: 500,
          },
        }),
    },
    {
      provide: GENERATION_QUEUE,
      useFactory: () => new Queue('generation', { connection }),
    },
  ],
  exports: [SUBMISSION_QUEUE, GENERATION_QUEUE, REDIS_CONNECTION],
})
export class QueueModule implements OnModuleDestroy {
  constructor(
    @Inject(SUBMISSION_QUEUE) private submissionQueue: Queue,
    @Inject(GENERATION_QUEUE) private generationQueue: Queue
  ) {}

  async onModuleDestroy() {
    await Promise.all([this.submissionQueue.close(), this.generationQueue.close()])
  }
}
