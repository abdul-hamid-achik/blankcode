import { requireUserId } from '../../../../utils/auth'
import { databaseStore } from '../../../../utils/session-store'
import { submitSession } from '../../../../utils/turn-session-service'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id') ?? ''
  const body = await readBody<{ code?: string }>(event)
  if (typeof body?.code !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'code is required' })
  }

  const { runHiddenTests } = await import('../../../../utils/turn-runner')

  const result = await submitSession(databaseStore(), id, userId, body.code, runHiddenTests)
  if (!result.ok) {
    throw createError({ statusCode: result.status, statusMessage: result.reason })
  }
  return result.value
})
