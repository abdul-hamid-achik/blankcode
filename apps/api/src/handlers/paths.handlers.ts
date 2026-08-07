import { HttpApiBuilder } from '@effect/platform'
import { Effect } from 'effect'
import { BlankCodeApi } from '../api/index.js'
import { PathsService } from '../modules/paths/paths.service.js'

export const PathsHandlers = HttpApiBuilder.group(BlankCodeApi, 'paths', (handlers) =>
  handlers
    .handle('getAll', () =>
      Effect.gen(function* () {
        const svc = yield* PathsService
        return yield* svc.findAll()
      })
    )
    .handle('getBySlug', ({ path }) =>
      Effect.gen(function* () {
        const svc = yield* PathsService
        return yield* svc.findBySlug(path.slug)
      })
    )
)
