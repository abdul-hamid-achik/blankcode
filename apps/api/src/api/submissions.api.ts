import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from '@effect/platform'
import { Schema } from 'effect'
import { Authorization } from '../middleware/auth.middleware.js'
import { SubmissionRateLimit } from '../middleware/rate-limit.middleware.js'
import { BadRequestError, NotFoundError, QueueError } from './errors.js'

const CreateSubmissionPayload = Schema.Struct({
  exerciseId: Schema.UUID,
  code: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(50000)),
})

const SubmissionQueryParams = Schema.Struct({
  exerciseId: Schema.optional(Schema.UUID),
  limit: Schema.optional(
    Schema.NumberFromString.pipe(
      Schema.int(),
      Schema.greaterThanOrEqualTo(1),
      Schema.lessThanOrEqualTo(100)
    )
  ),
  offset: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.nonNegative())),
})

export class SubmissionsApi extends HttpApiGroup.make('submissions')
  .add(
    HttpApiEndpoint.post('create', '/submissions')
      .setPayload(CreateSubmissionPayload)
      .addSuccess(Schema.Unknown)
      .addError(NotFoundError)
      .addError(BadRequestError)
      .addError(QueueError)
      .middleware(SubmissionRateLimit)
  )
  .add(
    HttpApiEndpoint.get('getById')`/submissions/${HttpApiSchema.param('id', Schema.String)}`
      .addSuccess(Schema.Unknown)
      .addError(NotFoundError)
  )
  .add(
    HttpApiEndpoint.get('list', '/submissions')
      .setUrlParams(SubmissionQueryParams)
      .addSuccess(Schema.Array(Schema.Unknown))
      .addError(NotFoundError)
  )
  .add(
    HttpApiEndpoint.post('retry')`/submissions/${HttpApiSchema.param('id', Schema.String)}/retry`
      .addSuccess(Schema.Unknown)
      .addError(NotFoundError)
      .addError(BadRequestError)
      .addError(QueueError)
      .middleware(SubmissionRateLimit)
  )
  .middleware(Authorization) {}
