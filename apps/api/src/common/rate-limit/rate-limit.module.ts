import { type ExecutionContext, Injectable, Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
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
        // Default high so non-auth endpoints aren't throttled.
        // @AuthThrottle() overrides to 5 req/60s on login/register.
        name: 'auth',
        ttl: config.rateLimit.authTtl,
        limit: config.rateLimit.limit,
      },
      {
        // Default high so polling isn't throttled.
        // @SubmissionThrottle() overrides to 30 req/60s on create/retry.
        name: 'submission',
        ttl: config.rateLimit.submissionTtl,
        limit: config.rateLimit.limit,
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
