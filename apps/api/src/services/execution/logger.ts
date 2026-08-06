type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  submissionId?: string
  exerciseId?: string
  language?: string
  [key: string]: unknown
}

function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString()
  const ctxStr = context
    ? Object.entries(context)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(' ')
    : ''

  return `[${timestamp}] [${level.toUpperCase()}]${ctxStr ? ` | ${ctxStr}` : ''} | ${message}`
}

const DEBUG_ENABLED = process.env['LOG_LEVEL'] === 'debug'

export const logger = {
  debug(message: string, context?: LogContext): void {
    if (!DEBUG_ENABLED) return
    // eslint-disable-next-line no-console
    console.log(formatMessage('debug', message, context))
  },
  info(message: string, context?: LogContext): void {
    // eslint-disable-next-line no-console
    console.log(formatMessage('info', message, context))
  },
  warn(message: string, context?: LogContext): void {
    // eslint-disable-next-line no-console
    console.warn(formatMessage('warn', message, context))
  },
  error(message: string, context?: LogContext): void {
    // eslint-disable-next-line no-console
    console.error(formatMessage('error', message, context))
  },
}
