import { loadOwnSession } from '~/server/utils/agent-session-service'
import { agentDatabaseStore } from '~/server/utils/agent-session-store'
import { requireUserId } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id') ?? ''
  const result = await loadOwnSession(agentDatabaseStore(), id, userId)
  if (!result.ok) {
    throw createError({ statusCode: result.status, statusMessage: result.reason })
  }
  return result.value
})
