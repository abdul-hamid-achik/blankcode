import { createDatabaseFromEnv } from '@blankcode/db/client'
import { exercises } from '@blankcode/db/schema'
import { eq } from 'drizzle-orm'
import { requireUserId } from '~/server/utils/auth'
import { databaseStore } from '~/server/utils/session-store'
import { revealTests } from '~/server/utils/turn-session-service'

/**
 * The hidden suite, once the session has earned it.
 *
 * This is the route the whole exercise depends on being wrong-proof: tests
 * visible during a session get pasted to the model, and then the skill being
 * practised is pasting.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id') ?? ''
  const db = createDatabaseFromEnv()

  const result = await revealTests(databaseStore(db), id, userId, async (exerciseId) => {
    const exercise = await db.query.exercises.findFirst({
      where: eq(exercises.id, exerciseId),
      columns: { testCode: true },
    })
    return exercise?.testCode ?? ''
  })

  if (!result.ok) {
    throw createError({ statusCode: result.status, statusMessage: result.reason })
  }
  return { testCode: result.value }
})
