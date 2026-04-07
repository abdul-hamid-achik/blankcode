import { HttpApiBuilder } from '@effect/platform'
import { Effect } from 'effect'
import { BlankCodeApi } from '../api/index.js'
import { CurrentUser } from '../middleware/auth.middleware.js'
import { ReviewsService } from '../modules/reviews/reviews.service.js'

export const ReviewsHandlers = HttpApiBuilder.group(BlankCodeApi, 'reviews', (handlers) =>
  handlers
    .handle('dueReviews', () =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const svc = yield* ReviewsService
        return yield* svc.getDueReviews(user.id)
      })
    )
    .handle('dueCount', () =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const svc = yield* ReviewsService
        const count = yield* svc.getDueCount(user.id)
        return { count }
      })
    )
    .handle('completeReview', ({ path, payload }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const svc = yield* ReviewsService
        yield* svc.recordReview(user.id, path.exerciseId, payload.passed)
      })
    )
)
