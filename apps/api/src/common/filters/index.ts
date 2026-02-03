import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common'
import { Catch, HttpException, HttpStatus } from '@nestjs/common'
import type { FastifyReply } from 'fastify'
import { ZodError } from 'zod'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<FastifyReply>()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let message = 'Internal server error'
    let details: Record<string, unknown> | undefined

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const exceptionResponse = exception.getResponse()
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : ((exceptionResponse as Record<string, unknown>)['message']?.toString() ??
            exception.message)
    } else if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST
      message = 'Validation error'
      details = {
        issues: exception.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      }
    } else if (exception instanceof Error) {
      message = exception.message
    }

    response.status(status).send({
      error: {
        code: HttpStatus[status] ?? 'UNKNOWN_ERROR',
        message,
        details,
      },
    })
  }
}
