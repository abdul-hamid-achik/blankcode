import { createDatabaseFromEnv } from '@blankcode/db/client'
import { harnessSessions } from '@blankcode/db/schema'
import { count, desc, eq, sum } from 'drizzle-orm'
import { requireUserId } from '../../../utils/auth'

/**
 * The owner's own agent activity, read back from the same table the MCP
 * endpoint writes on every tool call. Bookkeeping, not a usage report: the
 * last 10 sittings, most recent first, plus the totals across all of them —
 * so "where do I see agent activity" has an honest, ordinary answer.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const db = createDatabaseFromEnv()

  const [sessions, [totals]] = await Promise.all([
    db
      .select({
        clientName: harnessSessions.clientName,
        clientVersion: harnessSessions.clientVersion,
        toolCalls: harnessSessions.toolCalls,
        startedAt: harnessSessions.startedAt,
        lastSeenAt: harnessSessions.lastSeenAt,
      })
      .from(harnessSessions)
      .where(eq(harnessSessions.userId, userId))
      .orderBy(desc(harnessSessions.lastSeenAt))
      .limit(10),
    db
      .select({ sessions: count(), toolCalls: sum(harnessSessions.toolCalls) })
      .from(harnessSessions)
      .where(eq(harnessSessions.userId, userId)),
  ])

  return {
    sessions,
    totals: {
      sessions: totals?.sessions ?? 0,
      // drizzle's sum() comes back as a numeric string (or null with zero rows).
      toolCalls: Number(totals?.toolCalls ?? 0),
    },
  }
})
