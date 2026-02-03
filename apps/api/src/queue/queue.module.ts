import { Global, Module, type OnModuleDestroy } from '@nestjs/common'
import { Queue, type ConnectionOptions } from 'bullmq'
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
      useFactory: () => new Queue('submissions', { connection }),
    },
    {
      provide: GENERATION_QUEUE,
      useFactory: () => new Queue('generation', { connection }),
    },
  ],
  exports: [SUBMISSION_QUEUE, GENERATION_QUEUE, REDIS_CONNECTION],
})
export class QueueModule implements OnModuleDestroy {
  private queues: Queue[] = []

  constructor() {}

  async onModuleDestroy() {
    await Promise.all(this.queues.map((q) => q.close()))
  }
}
