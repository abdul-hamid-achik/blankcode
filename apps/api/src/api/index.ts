import { HttpApi, OpenApi } from '@effect/platform'
import { AchievementsApi } from './achievements.api.js'
import { AuthApi } from './auth.api.js'
import { ExercisesApi } from './exercises.api.js'
import { GenerationApi } from './generation.api.js'
import { HealthApi } from './health.api.js'
import { PathsApi } from './paths.api.js'
import { ProgressApi } from './progress.api.js'
import { ReviewsApi } from './reviews.api.js'
import { SubmissionsApi } from './submissions.api.js'
import { TracksApi } from './tracks.api.js'
import { UsersApi } from './users.api.js'

export class BlankCodeApi extends HttpApi.make('BlankCodeApi')
  .add(AuthApi)
  .add(UsersApi)
  .add(TracksApi)
  .add(ExercisesApi)
  .add(SubmissionsApi)
  .add(ProgressApi)
  .add(PathsApi)
  .add(AchievementsApi)
  .add(GenerationApi)
  .add(ReviewsApi)
  .add(HealthApi)
  .annotate(OpenApi.Title, 'BlankCode API')
  .annotate(OpenApi.Description, 'Interactive coding exercise platform') {}
