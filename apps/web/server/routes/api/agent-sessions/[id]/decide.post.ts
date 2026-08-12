import type { AgentAction } from '../../../../utils/agent-session'
import { takeDecision } from '../../../../utils/agent-session-service'
import { agentDatabaseStore } from '../../../../utils/agent-session-store'
import { requireUserId } from '../../../../utils/auth'
import { makeHiddenRunner } from '../../../../utils/turn-runner'

const ACTIONS = new Set<AgentAction>([
  'approve',
  'reject',
  'interrupt',
  'demand-evidence',
  'redirect',
])

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id') ?? ''
  const body = await readBody<{ action?: string; note?: string }>(event)
  if (typeof body?.action !== 'string' || !ACTIONS.has(body.action as AgentAction)) {
    throw createError({ statusCode: 400, statusMessage: 'action is required' })
  }

  const result = await takeDecision(
    agentDatabaseStore(),
    id,
    userId,
    body.action as AgentAction,
    body.note,
    makeHiddenRunner(userId, {})
  )
  if (!result.ok) {
    throw createError({ statusCode: result.status, statusMessage: result.reason })
  }
  return result.value
})
