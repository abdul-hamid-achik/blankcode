import { requireUserId } from '../../../../utils/auth'
import { submitAnswer } from '../../../../utils/context-session-service'
import { databaseContextStore } from '../../../../utils/context-session-store'
import { checkAnswer } from '../../../../utils/context-sources'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id') ?? ''
  const body = await readBody<{ answer?: string }>(event)
  if (typeof body?.answer !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'answer is required' })
  }

  const result = await submitAnswer(databaseContextStore(), id, userId, body.answer, checkAnswer)
  if (!result.ok) {
    throw createError({ statusCode: result.status, statusMessage: result.reason })
  }
  return result.value
})
