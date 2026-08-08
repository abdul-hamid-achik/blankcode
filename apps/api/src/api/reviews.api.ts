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
    // When the queue is empty (or before it is), the one question the page
    // could not answer: when does the next batch arrive? The date the
    // scheduler already computed, finally spoken.
    HttpApiEndpoint.get('upcoming', '/reviews/upcoming')
      .addSuccess(
        Schema.Struct({
          dueNow: Schema.Number,
          next: Schema.NullOr(Schema.Struct({ date: Schema.String, count: Schema.Number })),
        })
      )
      .addError(NotFoundError)
  )
  .add(
    // Agent passes the human has not explained: the schedule is holding each
    // one a day out instead of at its earned interval. The dashboard surfaces
    // this list because the hold is silent otherwise — a review arriving
    // "too soon" with no visible reason reads as a scheduler bug.
    HttpApiEndpoint.get('unexplained', '/reviews/unexplained').addSuccess(
      Schema.Array(
        Schema.Struct({
          exerciseId: Schema.String,
          title: Schema.String,
          passedAt: Schema.NullOr(Schema.String),
          nextReviewAt: Schema.String,
        })
      )
    )
  )
  .add(
    HttpApiEndpoint.post(
      'completeReview'
    )`/reviews/${HttpApiSchema.param('exerciseId', Schema.String)}/complete`
      .setPayload(CompleteReviewPayload)
      // The date the rating just set. Returning Void here forced the page to
      // say "scheduled forward" without being able to say until when — the
      // scheduler's whole output, computed and then hidden.
      .addSuccess(Schema.Struct({ nextReviewAt: Schema.String, intervalDays: Schema.Number }))
      .addError(NotFoundError)
  )
  .middleware(Authorization) {}
