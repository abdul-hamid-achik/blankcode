import { requireUserId } from '../../../../utils/auth'
import { databaseContextStore } from '../../../../utils/context-session-store'

/**
 * The session, for resume.
 *
 * One open session per exercise is enforced by the database, but a refresh
 * mid-purchase had no way back in. What travels: the menu (id, label,
 * price), which sources are held, and the status. Contents are NOT included
 * — the client re-requests each held source, which the service hands over
 * without charging again, so the one door to a source's content stays the
 * charging door.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id') ?? ''

  const session = await databaseContextStore().load(id)
  if (!session || session.userId !== userId) {
    throw createError({ statusCode: 404, statusMessage: 'Session not found' })
  }

  return {
    id: session.id,
    exerciseId: session.exerciseId,
    status: session.status,
    sources: session.sources,
    selected: session.selected,
    answer: session.answer,
  }
})
