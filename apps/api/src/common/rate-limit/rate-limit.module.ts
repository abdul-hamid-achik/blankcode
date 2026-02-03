import { Module, Injectable, type ExecutionContext } from '@nestjs/common'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { APP_GUARD } from '@nestjs/core'
import { config } from '../../config/index.js'

@Injectable()
export class FastifyThrottlerGuard extends ThrottlerGuard {
  override getRequestResponse(context: ExecutionContext) {
    const ctx = context.switchToHttp()
    return { req: ctx.getRequest(), res: ctx.getResponse() }
  }
}

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: config.rateLimit.ttl,
        limit: config.rateLimit.limit,
      },
      {
        name: 'auth',
        ttl: config.rateLimit.authTtl,
        limit: config.rateLimit.authLimit,
      },
      {
        name: 'submission',
        ttl: config.rateLimit.submissionTtl,
        limit: config.rateLimit.submissionLimit,
      },
    ]),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: FastifyThrottlerGuard,
    },
  ],
})
export class RateLimitModule {}
