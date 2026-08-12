import type { AgentAction } from '~/server/utils/agent-session'
import { takeDecision } from '~/server/utils/agent-session-service'
import { agentDatabaseStore } from '~/server/utils/agent-session-store'
import { requireUserId } from '~/server/utils/auth'
import { type HiddenRunOutcome, makeHiddenRunner } from '~/server/utils/turn-runner'

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

  const capture: { value?: HiddenRunOutcome } = {}
  const runner = makeHiddenRunner(userId, capture)
  const result = await takeDecision(
    agentDatabaseStore(),
    id,
    userId,
    body.action as AgentAction,
    body.note,
    async (code, exerciseId) => {
      const passed = await runner(code, exerciseId)
      return {
        passed,
        testResults: capture.value?.testResults,
        errorMessage: capture.value?.errorMessage,
      }
    }
  )
  if (!result.ok) {
    throw createError({ statusCode: result.status, statusMessage: result.reason })
  }
  return result.value
})
