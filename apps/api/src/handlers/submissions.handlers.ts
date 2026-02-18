import { HttpApiBuilder } from '@effect/platform'
import { Effect } from 'effect'
import { BlankCodeApi } from '../api/index.js'
import { CurrentUser } from '../middleware/auth.middleware.js'
import { SubmissionsService } from '../modules/submissions/submissions.service.js'

export const SubmissionsHandlers = HttpApiBuilder.group(BlankCodeApi, 'submissions', (handlers) =>
  handlers
    .handle('create', ({ payload }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const svc = yield* SubmissionsService
        return yield* svc.createAndExecute(user.id, payload)
      })
    )
    .handle('getById', ({ path }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const svc = yield* SubmissionsService
        return yield* svc.findById(path.id, user.id)
      })
    )
    .handle('list', ({ urlParams }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const svc = yield* SubmissionsService
        if (urlParams.exerciseId) {
          return yield* svc.findByExercise(urlParams.exerciseId, user.id)
        }
        return yield* svc.findByUser(user.id, urlParams.limit ?? 20, urlParams.offset ?? 0)
      })
    )
    .handle('retry', ({ path }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const svc = yield* SubmissionsService
        return yield* svc.retry(path.id, user.id)
      })
    )
)
