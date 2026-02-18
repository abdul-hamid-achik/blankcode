import { HttpApiBuilder } from '@effect/platform'
import { Effect } from 'effect'
import { BlankCodeApi } from '../api/index.js'
import { GenerationService } from '../modules/generation/generation.service.js'

export const GenerationHandlers = HttpApiBuilder.group(BlankCodeApi, 'generation', (handlers) =>
  handlers
    .handle('generate', ({ payload }) =>
      Effect.gen(function* () {
        const svc = yield* GenerationService
        return yield* svc.queueExerciseGeneration(payload)
      })
    )
    .handle('getJobStatus', ({ path }) =>
      Effect.gen(function* () {
        const svc = yield* GenerationService
        return yield* svc.getJobStatus(path.jobId)
      })
    )
)
