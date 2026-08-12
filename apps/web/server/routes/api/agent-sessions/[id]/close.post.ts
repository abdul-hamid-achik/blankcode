import { closeAgentSession } from '~/server/utils/agent-session-service'
import { agentDatabaseStore } from '~/server/utils/agent-session-store'
import { requireUserId } from '~/server/utils/auth'
import { type HiddenRunOutcome, makeHiddenRunner } from '~/server/utils/turn-runner'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id') ?? ''
  const body = await readBody<{ action?: string }>(event)
  if (body?.action !== 'accept-work' && body?.action !== 'reject-work') {
    throw createError({
      statusCode: 400,
      statusMessage: 'action must be accept-work or reject-work',
    })
  }

  const capture: { value?: HiddenRunOutcome } = {}
  const result = await closeAgentSession(
    agentDatabaseStore(),
    id,
    userId,
    body.action,
    makeHiddenRunner(userId, capture)
  )
  if (!result.ok) {
    throw createError({ statusCode: result.status, statusMessage: result.reason })
  }

  return {
    ...result.value,
    testResults: capture.value?.testResults ?? [],
    errorMessage: capture.value?.errorMessage ?? null,
  }
})
