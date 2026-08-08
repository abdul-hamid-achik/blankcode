import { createDatabaseFromEnv } from '@blankcode/db/client'
import { customDrills } from '@blankcode/db/schema'
import { desc, eq } from 'drizzle-orm'
import { requireUserId } from '../../../utils/auth'
import { redactDrillListItem } from '../../../utils/drill-generator'

/**
 * The caller's drills, newest first.
 *
 * Private in a way the reading list is not: a drill is generated from one
 * person's failures and says so, so there is no signed-out version of this
 * page and no aggregate worth showing. The session is required, and the query
 * is filtered by it rather than by anything in the request.
 *
 * The columns are named rather than selected wholesale. `custom_drills` carries
 * `solution_code`, `test_code` and each blank's answer, and a
 * `db.query.customDrills.findMany()` returns all of them by default — which is
 * exactly how the answer key ends up in a list of titles the next time somebody
 * edits this file. The list renders neither the starter nor the blanks, so
 * neither is fetched.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const db = createDatabaseFromEnv()

  const rows = await db
    .select({
      id: customDrills.id,
      title: customDrills.title,
      description: customDrills.description,
      conceptSlug: customDrills.conceptSlug,
      trackSlug: customDrills.trackSlug,
      language: customDrills.language,
      source: customDrills.source,
      attempts: customDrills.attempts,
      solvedAt: customDrills.solvedAt,
      createdAt: customDrills.createdAt,
    })
    .from(customDrills)
    .where(eq(customDrills.userId, userId))
    .orderBy(desc(customDrills.createdAt))

  return { drills: rows.map(redactDrillListItem) }
})
