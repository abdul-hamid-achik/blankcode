import type { TrackSlug } from '@blankcode/shared'
import { HttpApiBuilder } from '@effect/platform'
import { Effect } from 'effect'
import { BlankCodeApi } from '../api/index.js'
import { TracksService } from '../modules/tracks/tracks.service.js'

export const TracksHandlers = HttpApiBuilder.group(BlankCodeApi, 'tracks', (handlers) =>
  handlers
    .handle('list', () =>
      Effect.gen(function* () {
        const svc = yield* TracksService
        return yield* svc.findAll()
      })
    )
    .handle('getBySlug', ({ path }) =>
      Effect.gen(function* () {
        const svc = yield* TracksService
        return yield* svc.findBySlug(path.slug as TrackSlug)
      })
    )
)
