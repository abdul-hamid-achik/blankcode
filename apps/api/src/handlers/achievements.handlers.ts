import { ACHIEVEMENTS } from '@blankcode/shared'
import { HttpApiBuilder } from '@effect/platform'
import { Effect } from 'effect'
import { BlankCodeApi } from '../api/index.js'
import { CurrentUser } from '../middleware/auth.middleware.js'
import { AchievementsService } from '../modules/achievements/achievements.service.js'

export const AchievementsHandlers = HttpApiBuilder.group(BlankCodeApi, 'achievements', (handlers) =>
  handlers
    .handle('getAll', () => Effect.succeed(Object.values(ACHIEVEMENTS)))
    .handle('getMine', () =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const svc = yield* AchievementsService

        // Check for new achievements
        const newlyAwarded = yield* svc.checkAndAward(user.id)

        // Get all achievements
        const allAchievements = yield* svc.getMine(user.id)

        // Add isNew flag to newly awarded
        return allAchievements.map((a) => ({
          ...a,
          isNew: newlyAwarded.some((na) => na.type === a.type),
        }))
      })
    )
)
