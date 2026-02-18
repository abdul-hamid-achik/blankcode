import { DIFFICULTIES, TRACK_SLUGS } from '@blankcode/shared'
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from '@effect/platform'
import { Schema } from 'effect'
import { AdminAuthorization } from '../middleware/admin.middleware.js'
import { NotFoundError, QueueError } from './errors.js'

const GenerateExercisePayload = Schema.Struct({
  trackSlug: Schema.Literal(...TRACK_SLUGS),
  conceptSlug: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(100)),
  difficulty: Schema.Literal(...DIFFICULTIES),
  topic: Schema.optional(Schema.String.pipe(Schema.maxLength(200))),
})

export class GenerationApi extends HttpApiGroup.make('generation')
  .add(
    HttpApiEndpoint.post('generate', '/generation/exercises')
      .setPayload(GenerateExercisePayload)
      .addSuccess(Schema.Unknown)
      .addError(QueueError)
  )
  .add(
    HttpApiEndpoint.get(
      'getJobStatus'
    )`/generation/jobs/${HttpApiSchema.param('jobId', Schema.String)}`
      .addSuccess(Schema.Unknown)
      .addError(NotFoundError)
  )
  .middleware(AdminAuthorization) {}
