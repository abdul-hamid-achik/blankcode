import { createDatabaseFromEnv } from '@blankcode/db/client'
import { exercises } from '@blankcode/db/schema'
import { eq } from 'drizzle-orm'
import { startAgentSession } from '~/server/utils/agent-session-service'
import { agentDatabaseStore } from '~/server/utils/agent-session-store'
import { requireUserId } from '~/server/utils/auth'
import { type HiddenRunOutcome, makeHiddenRunner } from '~/server/utils/turn-runner'

function isUniqueViolation(error: unknown): boolean {
  for (let current = error; current; current = (current as { cause?: unknown }).cause) {
    if ((current as { code?: string }).code === '23505') return true
  }
  return false
}

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = await readBody<{ exerciseId?: string }>(event)
  if (!body?.exerciseId) {
    throw createError({ statusCode: 400, statusMessage: 'exerciseId is required' })
  }

  const db = createDatabaseFromEnv()
  const exercise = await db.query.exercises.findFirst({
    where: eq(exercises.id, body.exerciseId),
    columns: {
      id: true,
      type: true,
      agentBudget: true,
      interventionBudget: true,
      agentScript: true,
      starterCode: true,
    },
  })
  if (!exercise || exercise.type !== 'agent' || !exercise.agentScript) {
    throw createError({ statusCode: 404, statusMessage: 'Exercise not found' })
  }
  if (!exercise.agentBudget || !exercise.interventionBudget) {
    throw createError({ statusCode: 404, statusMessage: 'Exercise has no supervision budget' })
  }

  const capture: { value?: HiddenRunOutcome } = {}
  const runner = makeHiddenRunner(userId, capture)
  try {
    return await startAgentSession(
      agentDatabaseStore(db),
      userId,
      exercise.id,
      exercise.agentScript,
      exercise.agentBudget,
      exercise.interventionBudget,
      exercise.starterCode,
      async (code, exerciseId) => {
        const passed = await runner(code, exerciseId)
        return {
          passed,
          testResults: capture.value?.testResults,
          errorMessage: capture.value?.errorMessage,
        }
      }
    )
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw createError({ statusCode: 409, statusMessage: 'A session for this exercise is open' })
    }
    throw error
  }
})
