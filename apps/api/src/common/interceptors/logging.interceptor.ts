import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common'
import { Injectable, Logger } from '@nestjs/common'
import type { Observable } from 'rxjs'
import { tap } from 'rxjs'

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP')

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest()
    const { method, url } = req
    const start = Date.now()

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse()
        const duration = Date.now() - start
        this.logger.log(`${method} ${url} ${res.statusCode} ${duration}ms`)
      })
    )
  }
}
