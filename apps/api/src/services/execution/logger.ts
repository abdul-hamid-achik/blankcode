type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  submissionId?: string
  exerciseId?: string
  language?: string
  [key: string]: unknown
}

function _formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString()
  const ctxStr = context
    ? Object.entries(context)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(' ')
    : ''

  return `[${timestamp}] [${level.toUpperCase()}]${ctxStr ? ` | ${ctxStr}` : ''} | ${message}`
}

export const logger = {
  debug(message: string, context?: LogContext): void {},
  info(message: string, context?: LogContext): void {},
  warn(message: string, context?: LogContext): void {},
  error(message: string, context?: LogContext): void {},
}
