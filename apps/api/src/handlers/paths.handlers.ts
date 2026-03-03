import { LEARNING_PATHS } from '@blankcode/shared'
import { HttpApiBuilder } from '@effect/platform'
import { Effect } from 'effect'
import { BlankCodeApi } from '../api/index.js'

export const PathsHandlers = HttpApiBuilder.group(BlankCodeApi, 'paths', (handlers) =>
  handlers
    .handle('getAll', () => Effect.succeed(LEARNING_PATHS.filter((p) => p.isPublished)))
    .handle('getBySlug', ({ path }) =>
      Effect.succeed(LEARNING_PATHS.find((p) => p.slug === path.slug))
    )
)
