import { HttpApiBuilder } from '@effect/platform'
import { Effect } from 'effect'
import { BlankCodeApi } from '../api/index.js'
import { CurrentUser } from '../middleware/auth.middleware.js'
import { ReflectionsService } from '../modules/reflections/reflections.service.js'

export const ReflectionsHandlers = HttpApiBuilder.group(BlankCodeApi, 'reflections', (handlers) =>
  handlers
    .handle('createReflection', ({ payload }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const svc = yield* ReflectionsService
        return yield* svc.create(user.id, payload)
      })
    )
    .handle('reflectionsByExercise', ({ path }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const svc = yield* ReflectionsService
        return yield* svc.listByExercise(user.id, path.exerciseId)
      })
    )
)
