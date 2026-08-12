import { requireUserId } from '~/server/utils/auth'
import { databaseStore } from '~/server/utils/session-store'

/**
 * The session, for resume.
 *
 * The database enforces one open session per exercise, but a refresh
 * mid-session had no way back to it — the transcript existed and the page
 * could not ask for it, so F5 turned a live budget into a dead end. A
 * missing session and someone else's session are the same 404: session ids
 * are the only wall between one learner's transcript and another's.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id') ?? ''

  const session = await databaseStore().load(id)
  if (!session || session.userId !== userId) {
    throw createError({ statusCode: 404, statusMessage: 'Session not found' })
  }

  return {
    id: session.id,
    exerciseId: session.exerciseId,
    status: session.status,
    maxTurns: session.maxTurns,
    turnsUsed: session.turnsUsed,
    messages: session.messages,
    finalCode: session.finalCode,
  }
})
