import { requireUserId } from '../../../../utils/auth'
import { databaseStore } from '../../../../utils/session-store'
import { takeTurn } from '../../../../utils/turn-session-service'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id') ?? ''
  const body = await readBody<{ message?: string }>(event)

  // Checked before the session is touched: this route cannot work without a
  // key, and finding that out after a turn has been charged is the one outcome
  // that costs the learner something.
  if (!process.env['AI_GATEWAY_API_KEY'] && !process.env['VERCEL_OIDC_TOKEN']) {
    throw createError({ statusCode: 503, statusMessage: 'AI is not configured' })
  }

  const { generateReply } = await import('../../../../utils/turn-model')

  // The route composes the closure so the session service's Generate type
  // stays user-blind while the model still resolves per user (tier + plan).
  const result = await takeTurn(
    databaseStore(),
    (messages) => generateReply(messages, userId),
    id,
    userId,
    body?.message ?? ''
  )

  if (!result.ok) {
    throw createError({ statusCode: result.status, statusMessage: result.reason })
  }
  return result.value
})
