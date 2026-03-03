import { HttpApiBuilder } from '@effect/platform'
import { Effect } from 'effect'
import { BlankCodeApi } from '../api/index.js'
import { CurrentUser } from '../middleware/auth.middleware.js'
import { ExercisesService } from '../modules/exercises/exercises.service.js'

export const ExercisesHandlers = HttpApiBuilder.group(BlankCodeApi, 'exercises', (handlers) =>
  handlers
    .handle('getAll', () =>
      Effect.gen(function* () {
        const svc = yield* ExercisesService
        return yield* svc.findAll()
      })
    )
    .handle('getById', ({ path }) =>
      Effect.gen(function* () {
        const svc = yield* ExercisesService
        return yield* svc.findById(path.id)
      })
    )
    .handle('getByConceptSlug', ({ path }) =>
      Effect.gen(function* () {
        const svc = yield* ExercisesService
        return yield* svc.findByConceptSlug(path.trackSlug, path.conceptSlug)
      })
    )
    .handle('getBySlug', ({ path }) =>
      Effect.gen(function* () {
        const svc = yield* ExercisesService
        return yield* svc.findBySlug(path.trackSlug, path.conceptSlug, path.exerciseSlug)
      })
    )
    .handle('getProgress', ({ path }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const svc = yield* ExercisesService
        return yield* svc.findWithProgress(path.id, user.id)
      })
    )
    .handle('saveDraft', ({ path, payload }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const svc = yield* ExercisesService
        return yield* svc.saveDraft(user.id, path.id, payload.code)
      })
    )
    .handle('deleteDraft', ({ path }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const svc = yield* ExercisesService
        return yield* svc.deleteDraft(user.id, path.id)
      })
    )
)
