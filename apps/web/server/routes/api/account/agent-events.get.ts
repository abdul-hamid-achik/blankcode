import { createDatabaseFromEnv } from '@blankcode/db/client'
import { agentEvents, exercises } from '@blankcode/db/schema'
import { desc, eq } from 'drizzle-orm'
import { requireUserId } from '~/server/utils/auth'

/**
 * The live feed behind /connect's connected face: the last meaningful agent
 * actions, newest first, each labeled with the exercise it touched and the
 * verdict when there was one. The rows come from the MCP layer's
 * fire-and-forget ledger — reads of an exercise, runs, submissions,
 * recorded reflections — not from every tool call; harness_sessions already
 * counts those.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const db = createDatabaseFromEnv()

  const rows = await db
    .select({
      tool: agentEvents.tool,
      status: agentEvents.status,
      createdAt: agentEvents.createdAt,
      exerciseSlug: exercises.slug,
      exerciseTitle: exercises.title,
    })
    .from(agentEvents)
    .leftJoin(exercises, eq(agentEvents.exerciseId, exercises.id))
    .where(eq(agentEvents.userId, userId))
    .orderBy(desc(agentEvents.createdAt))
    .limit(25)

  return { events: rows }
})
