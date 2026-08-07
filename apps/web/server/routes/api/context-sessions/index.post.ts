import { createDatabaseFromEnv } from '@blankcode/db/client'
import { exercises } from '@blankcode/db/schema'
import { eq } from 'drizzle-orm'
import { requireUserId } from '../../../utils/auth'
import { startContextSession } from '../../../utils/context-session-service'
import { databaseContextStore } from '../../../utils/context-session-store'
import { sourcesFor } from '../../../utils/context-sources'

function isUniqueViolation(error: unknown): boolean {
  for (let current = error; current; current = (current as { cause?: unknown }).cause) {
    if ((current as { code?: string }).code === '23505') return true
  }
  return false
}

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = await readBody<{ exerciseId?: string }>(event)
  if (!body?.exerciseId) {
    throw createError({ statusCode: 400, statusMessage: 'exerciseId is required' })
  }

  const db = createDatabaseFromEnv()
  const exercise = await db.query.exercises.findFirst({
    where: eq(exercises.id, body.exerciseId),
    columns: { id: true },
  })
  if (!exercise) throw createError({ statusCode: 404, statusMessage: 'Exercise not found' })

  const definition = await sourcesFor(exercise.id)
  if (!definition) {
    throw createError({ statusCode: 404, statusMessage: 'Exercise has no context sources' })
  }

  try {
    const session = await startContextSession(
      databaseContextStore(db),
      userId,
      exercise.id,
      definition.sources,
      definition.required
    )
    return {
      id: session.id,
      // The menu, with prices. Labels and costs are public; contents are not.
      sources: session.sources.map((source) => ({
        id: source.id,
        label: source.label,
        tokens: source.tokens,
      })),
      selected: session.selected,
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw createError({ statusCode: 409, statusMessage: 'An attempt for this exercise is open' })
    }
    throw error
  }
})
