import { DatabaseLive } from '@blankcode/db/client'
import { HttpApiBuilder } from '@effect/platform'
import { Layer } from 'effect'
import { BlankCodeApi } from './api/index.js'
import { AchievementsHandlers } from './handlers/achievements.handlers.js'
// Handlers
import { AuthHandlers } from './handlers/auth.handlers.js'
import { ExercisesHandlers } from './handlers/exercises.handlers.js'
import { HealthHandlers } from './handlers/health.handlers.js'
import { PathsHandlers } from './handlers/paths.handlers.js'
import { ProgressHandlers } from './handlers/progress.handlers.js'
import { ReviewsHandlers } from './handlers/reviews.handlers.js'
import { SubmissionsHandlers } from './handlers/submissions.handlers.js'
import { TracksHandlers } from './handlers/tracks.handlers.js'
import { UsersHandlers } from './handlers/users.handlers.js'
import { AdminAuthorizationLive } from './middleware/admin.middleware.js'
// Middleware
import { AuthorizationLive } from './middleware/auth.middleware.js'
import { AuthRateLimitLive, SubmissionRateLimitLive } from './middleware/rate-limit.middleware.js'
import { AchievementsServiceLive } from './modules/achievements/achievements.service.js'
import { AuthServiceLive } from './modules/auth/auth.service.js'
import { ExercisesServiceLive } from './modules/exercises/exercises.service.js'
import { ProgressServiceLive } from './modules/progress/progress.service.js'
import { ReviewsServiceLive } from './modules/reviews/reviews.service.js'
import { SubmissionsServiceLive } from './modules/submissions/submissions.service.js'
import { TracksServiceLive } from './modules/tracks/tracks.service.js'
import { UsersServiceLive } from './modules/users/users.service.js'
// Services
import { JwtServiceLive } from './services/jwt.service.js'

/**
 * The API as a layer, with no server attached.
 *
 * Kept separate from `main.ts` so the same wiring can be served two ways: as a
 * long-running Node process (local development, `docker compose up`) or as a
 * web `fetch` handler mounted inside Nitro (production, one Vercel project).
 * Neither transport is allowed to acquire behaviour the other lacks — if the
 * routes differed by host, only one of them would be the tested one.
 */

const ServicesLive = Layer.mergeAll(
  AuthServiceLive,
  UsersServiceLive,
  TracksServiceLive,
  ExercisesServiceLive,
  SubmissionsServiceLive,
  ProgressServiceLive,
  AchievementsServiceLive,
  ReviewsServiceLive
)

const MiddlewareLive = Layer.mergeAll(
  AuthorizationLive,
  AdminAuthorizationLive,
  AuthRateLimitLive,
  SubmissionRateLimitLive
)

const HandlersLive = Layer.mergeAll(
  AuthHandlers,
  UsersHandlers,
  TracksHandlers,
  ExercisesHandlers,
  SubmissionsHandlers,
  ProgressHandlers,
  HealthHandlers,
  PathsHandlers,
  AchievementsHandlers,
  ReviewsHandlers
)

export const ApiLive = HttpApiBuilder.api(BlankCodeApi).pipe(
  Layer.provide(HandlersLive),
  Layer.provide(ServicesLive),
  Layer.provide(MiddlewareLive),
  Layer.provide(JwtServiceLive),
  Layer.provide(DatabaseLive)
)
