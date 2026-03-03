import { Drizzle } from '@blankcode/db/client'
import {
  exercises,
  learningPaths,
  submissions,
  userAchievements,
  userProgress,
} from '@blankcode/db/schema'
import { ACHIEVEMENTS } from '@blankcode/shared'
import { and, count, eq, gte, sql } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'

interface AchievementsServiceShape {
  readonly checkAndAward: (userId: string) => Effect.Effect<AwardedAchievement[]>
  readonly getMine: (userId: string) => Effect.Effect<any[]>
  readonly getProgress: (userId: string) => Effect.Effect<UserAchievementProgress>
}

export interface AwardedAchievement {
  type: string
  title: string
  description: string
  icon: string
  color: string
  isNew: boolean
}

export interface UserAchievementProgress {
  totalChallenges: number
  challengesByLanguage: Record<string, number>
  currentStreak: number
  perfectScores: number
  pathsCompleted: number
}

export class AchievementsService extends Context.Tag('AchievementsService')<
  AchievementsService,
  AchievementsServiceShape
>() {}

export const AchievementsServiceLive = Layer.effect(
  AchievementsService,
  Effect.gen(function* () {
    const db = yield* Drizzle

    return AchievementsService.of({
      checkAndAward: (userId) =>
        Effect.gen(function* () {
          const progress = yield* Effect.tryPromise({
            try: () => getUserProgress(db, userId),
            catch: () => new Error('Failed to get user progress'),
          })

          const existingAchievements = yield* Effect.tryPromise({
            try: () =>
              db.query.userAchievements.findMany({
                where: eq(userAchievements.userId, userId),
              }),
            catch: () => [],
          })

          const existingTypes = new Set(existingAchievements.map((a) => a.achievementType))
          const awarded: AwardedAchievement[] = []

          // Check each achievement
          for (const [type, definition] of Object.entries(ACHIEVEMENTS)) {
            if (existingTypes.has(type as any)) continue

            const shouldAward = yield* checkAchievement(db, userId, definition, progress)

            if (shouldAward) {
              yield* Effect.tryPromise({
                try: () =>
                  db.insert(userAchievements).values({
                    userId,
                    achievementType: type as any,
                    title: definition.title,
                    description: definition.description,
                    icon: definition.icon,
                    metadata: { progress },
                  }),
                catch: () => new Error('Failed to award achievement'),
              })

              awarded.push({
                type,
                title: definition.title,
                description: definition.description,
                icon: definition.icon,
                color: definition.color,
                isNew: true,
              })
            }
          }

          return awarded
        }),

      getMine: (userId) =>
        Effect.tryPromise({
          try: () =>
            db.query.userAchievements.findMany({
              where: eq(userAchievements.userId, userId),
              orderBy: (achievements, { desc }) => [desc(achievements.earnedAt)],
            }),
          catch: () => [],
        }),

      getProgress: (userId) =>
        Effect.tryPromise({
          try: () => getUserProgress(db, userId),
          catch: () => ({
            totalChallenges: 0,
            challengesByLanguage: {},
            currentStreak: 0,
            perfectScores: 0,
            pathsCompleted: 0,
          }),
        }),
    })
  })
)

async function getUserProgress(db: any, userId: string): Promise<UserAchievementProgress> {
  // Get all user's completed challenges with exercise info
  const completions = await db
    .select({
      exerciseId: userProgress.exerciseId,
      completedAt: userProgress.completedAt,
      attempts: userProgress.attempts,
      exerciseSlug: exercises.slug,
    })
    .from(userProgress)
    .leftJoin(exercises, eq(userProgress.exerciseId, exercises.id))
    .where(and(eq(userProgress.userId, userId), eq(userProgress.isCompleted, true)))

  // Count by language (extracted from exercise slug)
  const challengesByLanguage: Record<string, number> = {}
  for (const completion of completions) {
    const lang = extractLanguageFromSlug(completion.exerciseSlug)
    if (lang) {
      challengesByLanguage[lang] = (challengesByLanguage[lang] || 0) + 1
    }
  }

  // Calculate streak
  const streak = await calculateStreak(db, userId)

  // Count perfect scores (first attempt)
  const perfectScores = completions.filter((c) => c.attempts === 1).length

  return {
    totalChallenges: completions.length,
    challengesByLanguage,
    currentStreak: streak,
    perfectScores,
    pathsCompleted: 0, // Will be implemented later
  }
}

async function calculateStreak(db: any, userId: string): Promise<number> {
  const result = await db
    .select({
      date: sql<string>`DATE(${userProgress.completedAt})`,
      count: count(),
    })
    .from(userProgress)
    .where(and(eq(userProgress.userId, userId), eq(userProgress.isCompleted, true)))
    .groupBy(sql`DATE(${userProgress.completedAt})`)
    .orderBy(sql`DATE(${userProgress.completedAt}) DESC`)
    .limit(30)

  if (result.length === 0) return 0

  let streak = 0
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  // Check if user has activity today or yesterday (streak is still active)
  const dates = result.map((r) => r.date)
  if (!dates.includes(today) && !dates.includes(yesterday)) {
    return 0
  }

  // Count consecutive days
  for (let i = 0; i < result.length; i++) {
    const expectedDate = new Date(Date.now() - i * 86400000).toISOString().split('T')[0]
    if (dates.includes(expectedDate)) {
      streak++
    } else if (i > 0) {
      break
    }
  }

  return streak
}

function extractLanguageFromSlug(slug: string | null): string | null {
  if (!slug) return null
  const match = slug.match(/^(ts|py|go|ru|re|vue)-challenge/)
  if (!match) return null

  const langMap: Record<string, string> = {
    ts: 'typescript',
    py: 'python',
    go: 'go',
    ru: 'rust',
    re: 'react',
    vue: 'vue',
  }
  return langMap[match[1]] || null
}

async function checkAchievement(
  db: any,
  userId: string,
  definition: any,
  progress: UserAchievementProgress
): Promise<boolean> {
  const req = definition.requirement

  switch (req.type) {
    case 'challenges_completed':
      return progress.totalChallenges >= (req.count || 0)

    case 'languages_completed': {
      if (req.languages) {
        // Check specific languages
        return req.languages.every((lang: string) => (progress.challengesByLanguage[lang] || 0) > 0)
      }
      // Count languages with at least 1 challenge
      const langCount = Object.values(progress.challengesByLanguage).filter((c) => c > 0).length
      return langCount >= (req.count || 0)
    }

    case 'streak':
      return progress.currentStreak >= (req.count || 0)

    case 'perfect_score':
      return progress.perfectScores >= (req.count || 0)

    case 'time_limit': {
      // Check recent submissions for fast completion
      const recentSubmissions = await db.query.submissions.findMany({
        where: and(eq(submissions.userId, userId), eq(submissions.status, 'passed')),
        orderBy: (submissions, { desc }) => [desc(submissions.createdAt)],
        limit: 10,
      })

      return recentSubmissions.some((s) => {
        if (!s.createdAt) return false
        const duration = Date.now() - new Date(s.createdAt).getTime()
        return duration <= (req.timeMs || 0)
      })
    }

    default:
      return false
  }
}
