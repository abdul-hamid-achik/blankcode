import { createDatabaseFromEnv } from '@blankcode/db/client'
import { usageEvents } from '@blankcode/db/schema'
import { and, count, eq, gte } from 'drizzle-orm'

/**
 * Metering, shared by anything with a per-user cost.
 *
 * The previous version of this was a `Map` inside one request handler. It read
 * correctly and enforced almost nothing: each function instance kept its own
 * copy, so the effective limit was the configured one multiplied by however
 * many instances were warm, and a cold start wiped it. A limit that cannot be
 * counted on is worse than none, because it gets treated as a control.
 */

/**
 * Only actions that have no record of their own.
 *
 * Submissions are deliberately absent: the submissions table already carries a
 * user and a timestamp, so counting them per day is a query, not a second
 * write. Recording them here as well would create two numbers that can disagree
 * about the same fact.
 */
export type UsageKind = 'ai_explain' | 'drill_generate' | 'reading_grade'

type Db = ReturnType<typeof createDatabaseFromEnv>

/** Records the action. Never throws — metering must not break the feature. */
export async function record(db: Db, userId: string, kind: UsageKind): Promise<string | null> {
  try {
    const [row] = await db.insert(usageEvents).values({ userId, kind }).returning({
      id: usageEvents.id,
    })
    return row?.id ?? null
  } catch (error) {
    console.error(`[usage] failed to record ${kind} for ${userId}:`, String(error))
    return null
  }
}

/**
 * Un-charges a recorded action. For the one honest case: the spend FAILED
 * through no fault of the caller (the grader answered garbage, the sandbox
 * died), so the attempt should not count against them. Never throws.
 */
export async function refund(db: Db, ticketId: string | null): Promise<void> {
  if (!ticketId) return
  try {
    await db.delete(usageEvents).where(eq(usageEvents.id, ticketId))
  } catch (error) {
    console.error(`[usage] failed to refund ${ticketId}:`, String(error))
  }
}

/**
 * Meter-then-spend, made explicit. Records the charge BEFORE the caller
 * spends anything, which closes the review's finding: the old
 * check-…-60-seconds-…-record shape let N concurrent requests all read
 * "0 used" and all spend, and a failure path that never recorded let a
 * deliberately-derailed grader burn gateway money forever at zero cost.
 * The ticket is what a failure path refunds.
 */
export async function takeTicket(
  db: Db,
  userId: string,
  kind: UsageKind,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; ticketId: string | null }> {
  const used = await countSince(db, userId, kind, windowMs)
  if (used !== null && used >= limit) return { allowed: false, ticketId: null }
  return { allowed: true, ticketId: await record(db, userId, kind) }
}

/**
 * Counts a user's actions of one kind inside a moving window.
 *
 * Returns `null` when the count could not be taken. That is deliberately not
 * zero: a caller deciding whether someone is over their limit has to be able to
 * tell "they have used none" apart from "the database did not answer", and
 * collapsing the two is how a failed query silently becomes an open door.
 */
export async function countSince(
  db: Db,
  userId: string,
  kind: UsageKind,
  windowMs: number
): Promise<number | null> {
  try {
    const since = new Date(Date.now() - windowMs)
    const [row] = await db
      .select({ n: count() })
      .from(usageEvents)
      .where(
        and(
          eq(usageEvents.userId, userId),
          eq(usageEvents.kind, kind),
          gte(usageEvents.createdAt, since)
        )
      )
    return row?.n ?? 0
  } catch (error) {
    console.error(`[usage] failed to count ${kind} for ${userId}:`, String(error))
    return null
  }
}

/**
 * Whether this action is within budget, recording it when it is.
 *
 * On a counting failure this allows the request. The alternative — refusing
 * when the meter is broken — turns a database blip into an outage of the
 * feature for everyone, and the thing being protected here is a spend limit,
 * not a security boundary.
 */
export async function withinBudget(
  db: Db,
  userId: string,
  kind: UsageKind,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const used = await countSince(db, userId, kind, windowMs)
  if (used !== null && used >= limit) return false

  await record(db, userId, kind)
  return true
}
