import { createDatabaseFromEnv } from '@blankcode/db/client'
import { apiTokens, harnessSessions, submissions, usageEvents } from '@blankcode/db/schema'
import { and, count, desc, eq, gte, sum } from 'drizzle-orm'
import { requireUserId } from '../../../utils/auth'

/**
 * The owner's own agent activity, read back from the same table the MCP
 * endpoint writes on every tool call. Bookkeeping, not a usage report: the
 * last 10 sittings, most recent first, the totals across all of them, and
 * what today's agent work amounted to — so "where do I see agent activity"
 * has an honest, ordinary answer, and /connect can flip to its connected
 * face on real evidence instead of hope.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const db = createDatabaseFromEnv()
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [sessions, [totals], [runsToday], [agentSubmissionsToday]] = await Promise.all([
    db
      .select({
        clientName: harnessSessions.clientName,
        clientVersion: harnessSessions.clientVersion,
        toolCalls: harnessSessions.toolCalls,
        startedAt: harnessSessions.startedAt,
        lastSeenAt: harnessSessions.lastSeenAt,
        tokenName: apiTokens.name,
      })
      .from(harnessSessions)
      .leftJoin(apiTokens, eq(harnessSessions.apiTokenId, apiTokens.id))
      .where(eq(harnessSessions.userId, userId))
      .orderBy(desc(harnessSessions.lastSeenAt))
      .limit(10),
    db
      .select({ sessions: count(), toolCalls: sum(harnessSessions.toolCalls) })
      .from(harnessSessions)
      .where(eq(harnessSessions.userId, userId)),
    db
      .select({ n: count() })
      .from(usageEvents)
      .where(
        and(
          eq(usageEvents.userId, userId),
          eq(usageEvents.kind, 'practice_run'),
          gte(usageEvents.createdAt, dayAgo)
        )
      ),
    db
      .select({ n: count() })
      .from(submissions)
      .where(
        and(
          eq(submissions.userId, userId),
          eq(submissions.via, 'agent'),
          gte(submissions.createdAt, dayAgo)
        )
      ),
  ])

  return {
    sessions,
    totals: {
      sessions: totals?.sessions ?? 0,
      // drizzle's sum() comes back as a numeric string (or null with zero rows).
      toolCalls: Number(totals?.toolCalls ?? 0),
    },
    today: {
      runs: runsToday?.n ?? 0,
      agentSubmissions: agentSubmissionsToday?.n ?? 0,
    },
  }
})
