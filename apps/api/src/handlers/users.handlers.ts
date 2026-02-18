import { HttpApiBuilder } from '@effect/platform'
import { Effect } from 'effect'
import { BlankCodeApi } from '../api/index.js'
import { CurrentUser } from '../middleware/auth.middleware.js'
import { UsersService } from '../modules/users/users.service.js'

export const UsersHandlers = HttpApiBuilder.group(BlankCodeApi, 'users', (handlers) =>
  handlers
    .handle('getMe', () =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const svc = yield* UsersService
        return yield* svc.findById(user.id)
      })
    )
    .handle('getByUsername', ({ path }) =>
      Effect.gen(function* () {
        const svc = yield* UsersService
        return yield* svc.findByUsername(path.username)
      })
    )
    .handle('updateMe', ({ payload }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const svc = yield* UsersService
        return yield* svc.update(user.id, payload)
      })
    )
)
