import { HttpApiBuilder } from '@effect/platform'
import { Effect } from 'effect'
import { BlankCodeApi } from '../api/index.js'
import { CurrentUser } from '../middleware/auth.middleware.js'
import { ProgressService } from '../modules/progress/progress.service.js'

export const ProgressHandlers = HttpApiBuilder.group(BlankCodeApi, 'progress', (handlers) =>
  handlers
    .handle('summary', () =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const svc = yield* ProgressService
        return yield* svc.getSummary(user.id)
      })
    )
    .handle('stats', () =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const svc = yield* ProgressService
        return yield* svc.getStats(user.id)
      })
    )
    .handle('exerciseProgress', ({ path }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const svc = yield* ProgressService
        return yield* svc.getExerciseProgress(user.id, path.exerciseId)
      })
    )
    .handle('conceptMastery', ({ path }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const svc = yield* ProgressService
        return yield* svc.getConceptMastery(user.id, path.conceptId)
      })
    )
    .handle('trackProgress', ({ path }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const svc = yield* ProgressService
        return yield* svc.getTrackProgress(user.id, path.trackSlug)
      })
    )
    .handle('activity', () =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const svc = yield* ProgressService
        return yield* svc.getActivityTimeline(user.id)
      })
    )
)
