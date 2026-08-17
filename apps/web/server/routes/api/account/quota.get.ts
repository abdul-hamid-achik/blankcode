import { createDatabaseFromEnv } from '@blankcode/db/client'
import { submissions, usageEvents, users } from '@blankcode/db/schema'
import {
  FREE_DAILY_EXPLANATIONS,
  FREE_DAILY_RUNS,
  FREE_DAILY_SUBMISSIONS,
  limitsFor,
} from '@blankcode/shared'
import { and, count, eq, gte } from 'drizzle-orm'
import { requireUserId } from '~/server/utils/auth'

/**
 * What a free account has left today. Paid accounts get `paid: true` and
 * null remainders — the action bar stays quiet.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const db = createDatabaseFromEnv()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { subscriptionStatus: true, subscriptionEndsAt: true },
  })

  const limits = limitsFor(
    {
      subscriptionStatus: user?.subscriptionStatus ?? null,
      subscriptionEndsAt: user?.subscriptionEndsAt ?? null,
    },
    new Date()
  )

  if (limits.paid) {
    return {
      paid: true,
      submissionsRemaining: null,
      submissionsLimit: null,
      runsRemaining: null,
      runsLimit: null,
    }
  }

  const [subRow] = await db
    .select({ n: count() })
    .from(submissions)
    .where(and(eq(submissions.userId, userId), gte(submissions.createdAt, since)))

  const [runRow] = await db
    .select({ n: count() })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.userId, userId),
        eq(usageEvents.kind, 'practice_run'),
        gte(usageEvents.createdAt, since)
      )
    )

  const usedSubs = subRow?.n ?? 0
  const usedRuns = runRow?.n ?? 0

  return {
    paid: false,
    submissionsRemaining: Math.max(0, FREE_DAILY_SUBMISSIONS - usedSubs),
    submissionsLimit: FREE_DAILY_SUBMISSIONS,
    runsRemaining: Math.max(0, FREE_DAILY_RUNS - usedRuns),
    runsLimit: FREE_DAILY_RUNS,
    explanationsLimit: FREE_DAILY_EXPLANATIONS,
  }
})
