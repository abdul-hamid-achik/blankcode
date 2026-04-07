import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from '@effect/platform'
import { Schema } from 'effect'
import { Authorization } from '../middleware/auth.middleware.js'
import { NotFoundError } from './errors.js'

const CompleteReviewPayload = Schema.Struct({
  passed: Schema.Boolean,
})

export class ReviewsApi extends HttpApiGroup.make('reviews')
  .add(
    HttpApiEndpoint.get('dueReviews', '/reviews/due')
      .addSuccess(Schema.Array(Schema.Unknown))
      .addError(NotFoundError)
  )
  .add(
    HttpApiEndpoint.get('dueCount', '/reviews/due/count')
      .addSuccess(Schema.Struct({ count: Schema.Number }))
      .addError(NotFoundError)
  )
  .add(
    HttpApiEndpoint.post(
      'completeReview'
    )`/reviews/${HttpApiSchema.param('exerciseId', Schema.String)}/complete`
      .setPayload(CompleteReviewPayload)
      .addSuccess(Schema.Void)
      .addError(NotFoundError)
  )
  .middleware(Authorization) {}
