import { HttpApiEndpoint, HttpApiGroup } from '@effect/platform'
import { Schema } from 'effect'
import { Authorization } from '../middleware/auth.middleware.js'

export class AchievementsApi extends HttpApiGroup.make('achievements')
  .add(
    HttpApiEndpoint.get('getMine')`/achievements`
      .addSuccess(Schema.Array(Schema.Unknown))
      .middleware(Authorization)
  )
  .add(
    HttpApiEndpoint.get('getAll')`/achievements/definitions`.addSuccess(
      Schema.Array(Schema.Unknown)
    )
  ) {}
