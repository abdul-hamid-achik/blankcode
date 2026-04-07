import { Drizzle } from '@blankcode/db/client'
import { exercises, submissions, userAchievements, userProgress } from '@blankcode/db/schema'
import { ACHIEVEMENTS } from '@blankcode/shared'
import { and, count, eq, sql } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'

interface AchievementsServiceShape {
  readonly checkAndAward: (userId: string) => Effect.Effect<AwardedAchievement[], never, never>
  readonly getMine: (userId: string) => Effect.Effect<AwardedAchievement[], never, never>
  readonly getProgress: (userId: string) => Effect.Effect<UserAchievementProgress, never, never>
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
        Effect.tryPromise({
          try: async () => {
            const progress = await getUserProgress(db, userId)

            const existingAchievements = await db.query.userAchievements.findMany({
              where: eq(userAchievements.userId, userId),
            })

            const existingTypes = new Set(existingAchievements.map((a) => a.achievementType))
            const awarded: AwardedAchievement[] = []

            for (const [type, definition] of Object.entries(ACHIEVEMENTS)) {
              if (existingTypes.has(type)) continue

              const shouldAward = await checkAchievement(db, userId, definition, progress)

              if (shouldAward) {
                await db.insert(userAchievements).values({
                  userId,
                  achievementType: type,
                  title: definition.title,
                  description: definition.description,
                  icon: definition.icon,
                  metadata: { progress },
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
          },
          catch: () => new Error('Failed to check and award achievements'),
        }).pipe(Effect.catchAll(() => Effect.succeed([] as AwardedAchievement[]))),

      getMine: (userId) =>
        Effect.tryPromise({
          try: () =>
            db.query.userAchievements
              .findMany({
                where: eq(userAchievements.userId, userId),
                orderBy: (achievements, { desc }) => [desc(achievements.earnedAt)],
              })
              .then((rows: (typeof userAchievements.$inferSelect)[]) =>
                rows.map((row) => ({
                  type: row.achievementType,
                  title: row.title,
                  description: row.description,
                  icon: row.icon,
                  color: (row.metadata as { color?: string } | null)?.color ?? '',
                  isNew: false,
                }))
              ),
          catch: () => new Error('Failed to fetch achievements'),
        }).pipe(Effect.catchAll(() => Effect.succeed([] as AwardedAchievement[]))),

      getProgress: (userId) =>
        Effect.tryPromise({
          try: () => getUserProgress(db, userId),
          catch: () => ({
            totalChallenges: 0,
            challengesByLanguage: {} as Record<string, number>,
            currentStreak: 0,
            perfectScores: 0,
            pathsCompleted: 0,
          }),
        }).pipe(
          Effect.catchAll(() =>
            Effect.succeed({
              totalChallenges: 0,
              challengesByLanguage: {} as Record<string, number>,
              currentStreak: 0,
              perfectScores: 0,
              pathsCompleted: 0,
            })
          )
        ),
    })
  })
)

async function getUserProgress(db: any, userId: string): Promise<UserAchievementProgress> {
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

  const challengesByLanguage: Record<string, number> = {}
  for (const completion of completions) {
    const lang = extractLanguageFromSlug(completion.exerciseSlug)
    if (lang) {
      challengesByLanguage[lang] = (challengesByLanguage[lang] || 0) + 1
    }
  }

  const streak = await calculateStreak(db, userId)
  const perfectScores = completions.filter(
    (c: typeof userProgress.$inferSelect) => c.attempts === 1
  ).length

  return {
    totalChallenges: completions.length,
    challengesByLanguage,
    currentStreak: streak,
    perfectScores,
    pathsCompleted: 0,
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

  const dates = result.map((r: { date: string }) => r.date)
  if (!dates.includes(today) && !dates.includes(yesterday)) {
    return 0
  }

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
  const langKey = match[1]
  return langKey ? (langMap[langKey] ?? null) : null
}

async function checkAchievement(
  db: any,
  userId: string,
  definition: {
    requirement: { type: string; count?: number; languages?: string[]; timeMs?: number }
  },
  progress: UserAchievementProgress
): Promise<boolean> {
  const req = definition.requirement

  switch (req.type) {
    case 'challenges_completed':
      return progress.totalChallenges >= (req.count || 0)

    case 'languages_completed': {
      if (req.languages) {
        return req.languages.every((lang: string) => (progress.challengesByLanguage[lang] || 0) > 0)
      }
      const langCount = Object.values(progress.challengesByLanguage).filter(
        (c: number) => c > 0
      ).length
      return langCount >= (req.count || 0)
    }

    case 'streak':
      return progress.currentStreak >= (req.count || 0)

    case 'perfect_score':
      return progress.perfectScores >= (req.count || 0)

    case 'time_limit': {
      const recentSubmissions = await db.query.submissions.findMany({
        where: and(eq(submissions.userId, userId), eq(submissions.status, 'passed')),
        orderBy: (submissions: any, { desc }: { desc: any }) => [desc(submissions.createdAt)],
        limit: 10,
      })

      return recentSubmissions.some((s: { createdAt: Date | null }) => {
        if (!s.createdAt) return false
        const duration = Date.now() - new Date(s.createdAt).getTime()
        return duration <= (req.timeMs || 0)
      })
    }

    default:
      return false
  }
}
