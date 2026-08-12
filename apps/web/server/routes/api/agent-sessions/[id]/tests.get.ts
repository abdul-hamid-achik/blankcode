import { createDatabaseFromEnv } from '@blankcode/db/client'
import { exercises } from '@blankcode/db/schema'
import { eq } from 'drizzle-orm'
import { revealAgentTests } from '../../../../utils/agent-session-service'
import { agentDatabaseStore } from '../../../../utils/agent-session-store'
import { requireUserId } from '../../../../utils/auth'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id') ?? ''

  const result = await revealAgentTests(agentDatabaseStore(), id, userId, async (exerciseId) => {
    const db = createDatabaseFromEnv()
    const exercise = await db.query.exercises.findFirst({
      where: eq(exercises.id, exerciseId),
      columns: { testCode: true },
    })
    if (!exercise) throw createError({ statusCode: 404, statusMessage: 'Exercise not found' })
    return exercise.testCode
  })
  if (!result.ok) {
    throw createError({ statusCode: result.status, statusMessage: result.reason })
  }
  return { tests: result.value }
})
