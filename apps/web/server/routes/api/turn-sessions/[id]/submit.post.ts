import { requireUserId } from '~/server/utils/auth'
import { databaseStore } from '~/server/utils/session-store'
import { type HiddenRunOutcome, makeHiddenRunner } from '~/server/utils/turn-runner'
import { submitSession } from '~/server/utils/turn-session-service'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id') ?? ''
  const body = await readBody<{ code?: string }>(event)
  if (typeof body?.code !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'code is required' })
  }

  // The run's details are captured beside the boolean the service needs, so
  // the response can name the failing tests without widening the service's
  // contract to know about test frameworks.
  const capture: { value?: HiddenRunOutcome } = {}

  const result = await submitSession(
    databaseStore(),
    id,
    userId,
    body.code,
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
