import { requireUserId } from '../../../../utils/auth'
import { selectSource } from '../../../../utils/context-session-service'
import { databaseContextStore } from '../../../../utils/context-session-store'
import { contentFor } from '../../../../utils/context-sources'

/** Hands over one source and charges for it. */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id') ?? ''
  const body = await readBody<{ sourceId?: string }>(event)
  if (!body?.sourceId) {
    throw createError({ statusCode: 400, statusMessage: 'sourceId is required' })
  }

  const result = await selectSource(databaseContextStore(), id, userId, body.sourceId, contentFor)
  if (!result.ok) {
    throw createError({ statusCode: result.status, statusMessage: result.reason })
  }
  return result.value
})
