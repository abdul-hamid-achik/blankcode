import { Logger } from '@nestjs/common'

export interface LogContext {
  submissionId?: string
  exerciseId?: string
  language?: string
  [key: string]: unknown
}

const nestLogger = new Logger('Execution')

function formatContext(context?: LogContext): string {
  if (!context) return ''
  const parts = Object.entries(context)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v}`)
  return parts.length > 0 ? ` [${parts.join(', ')}]` : ''
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    nestLogger.debug(`${message}${formatContext(context)}`)
  },
  info(message: string, context?: LogContext): void {
    nestLogger.log(`${message}${formatContext(context)}`)
  },
  warn(message: string, context?: LogContext): void {
    nestLogger.warn(`${message}${formatContext(context)}`)
  },
  error(message: string, context?: LogContext): void {
    nestLogger.error(`${message}${formatContext(context)}`)
  },
}
