export interface LogContext {
  submissionId?: string
  exerciseId?: string
  language?: string
  [key: string]: unknown
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString()
  const payload = {
    timestamp,
    level,
    message,
    ...context,
  }
  return JSON.stringify(payload)
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    console.log(formatMessage('debug', message, context))
  },
  info(message: string, context?: LogContext): void {
    console.log(formatMessage('info', message, context))
  },
  warn(message: string, context?: LogContext): void {
    console.warn(formatMessage('warn', message, context))
  },
  error(message: string, context?: LogContext): void {
    console.error(formatMessage('error', message, context))
  },
}
