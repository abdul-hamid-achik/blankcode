import { Global, Module, type OnModuleDestroy } from '@nestjs/common'
import { Queue, Worker, type ConnectionOptions } from 'bullmq'
import { config } from '../config/index.js'

export const SUBMISSION_QUEUE = Symbol('SUBMISSION_QUEUE')
export const GENERATION_QUEUE = Symbol('GENERATION_QUEUE')

const connection: ConnectionOptions = {
  host: config.redis.host,
  port: config.redis.port,
}

@Global()
@Module({
  providers: [
    {
      provide: SUBMISSION_QUEUE,
      useFactory: () => new Queue('submissions', { connection }),
    },
    {
      provide: GENERATION_QUEUE,
      useFactory: () => new Queue('generation', { connection }),
    },
  ],
  exports: [SUBMISSION_QUEUE, GENERATION_QUEUE],
})
export class QueueModule implements OnModuleDestroy {
  private queues: Queue[] = []

  constructor() {}

  async onModuleDestroy() {
    await Promise.all(this.queues.map((q) => q.close()))
  }
}
