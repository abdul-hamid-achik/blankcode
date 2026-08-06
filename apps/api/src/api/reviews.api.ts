import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from '@effect/platform'
import { Schema } from 'effect'
import { Authorization } from '../middleware/auth.middleware.js'
import { NotFoundError } from './errors.js'

const CompleteReviewPayload = Schema.Struct({
  passed: Schema.Boolean,
  // Self-rating after a passed submission. 3=hard, 4=good, 5=easy.
  // Ignored when passed=false (treated as 1=fail).
  quality: Schema.optional(Schema.Literal(3, 4, 5)),
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
