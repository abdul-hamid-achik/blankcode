import { createDatabaseFromEnv } from '@blankcode/db/client'
import { customDrills } from '@blankcode/db/schema'
import { and, eq } from 'drizzle-orm'
import { requireUserId } from '../../../utils/auth'
import { isDrillId, redactDrill } from '../../../utils/drill-generator'

/**
 * One of the caller's drills, redacted the way an exercise is.
 *
 * `starterCode` and the blanks' offsets go out; `solutionCode`, `testCode` and
 * each blank's `solution` never do. That is not a nicety — grading happens in
 * `attempt.post.ts` precisely because the answers cannot come to the browser,
 * and a drill whose answers ship with it is a page you read.
 *
 * Ownership is checked in the WHERE clause, not after the read. A drill id is a
 * uuid, but guessing one should still not open somebody else's practice, and
 * "not yours" and "does not exist" get the same 404 for the same reason.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)

  const id = getRouterParam(event, 'id') ?? ''
  // A malformed uuid reaches Postgres as a cast error and comes back a 500.
  if (!isDrillId(id)) {
    throw createError({ statusCode: 404, statusMessage: 'Drill not found' })
  }

  const db = createDatabaseFromEnv()

  const [row] = await db
    .select({
      id: customDrills.id,
      title: customDrills.title,
      description: customDrills.description,
      conceptSlug: customDrills.conceptSlug,
      trackSlug: customDrills.trackSlug,
      language: customDrills.language,
      starterCode: customDrills.starterCode,
      blanks: customDrills.blanks,
      source: customDrills.source,
      attempts: customDrills.attempts,
      solvedAt: customDrills.solvedAt,
      createdAt: customDrills.createdAt,
    })
    .from(customDrills)
    .where(and(eq(customDrills.id, id), eq(customDrills.userId, userId)))
    .limit(1)

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Drill not found' })
  }

  return { drill: redactDrill(row) }
})
