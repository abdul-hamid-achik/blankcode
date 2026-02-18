import { HttpApiBuilder } from '@effect/platform'
import { Effect } from 'effect'
import { BlankCodeApi } from '../api/index.js'
import { AuthService } from '../modules/auth/auth.service.js'

export const AuthHandlers = HttpApiBuilder.group(BlankCodeApi, 'auth', (handlers) =>
  handlers
    .handle('register', ({ payload }) =>
      Effect.gen(function* () {
        const auth = yield* AuthService
        return yield* auth.register(payload)
      })
    )
    .handle('login', ({ payload }) =>
      Effect.gen(function* () {
        const auth = yield* AuthService
        return yield* auth.login(payload)
      })
    )
    .handle('refresh', ({ payload }) =>
      Effect.gen(function* () {
        const auth = yield* AuthService
        return yield* auth.validateAndRotateRefreshToken(payload.refreshToken)
      })
    )
    .handle('logout', ({ payload }) =>
      Effect.gen(function* () {
        const auth = yield* AuthService
        yield* auth.revokeRefreshToken(payload.refreshToken)
      })
    )
)
