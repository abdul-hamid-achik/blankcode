import { HttpApiBuilder } from '@effect/platform'
import { Effect } from 'effect'
import { BlankCodeApi } from '../api/index.js'

export const HealthHandlers = HttpApiBuilder.group(BlankCodeApi, 'health', (handlers) =>
  handlers.handle('check', () =>
    Effect.succeed({
      status: 'ok',
      timestamp: new Date().toISOString(),
    })
  )
)
