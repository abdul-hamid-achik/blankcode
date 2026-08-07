import { createDatabaseFromEnv } from '@blankcode/db/client'
import { userProgress } from '@blankcode/db/schema'
import { requireUserId } from '../../../../utils/auth'
import { passed } from '../../../../utils/context-budget'
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

  const store = databaseContextStore()
  const result = await submitAnswer(store, id, userId, body.answer, checkAnswer)
  if (!result.ok) {
    throw createError({ statusCode: result.status, statusMessage: result.reason })
  }

  /*
   * A passing session marks the exercise complete, so form E shows up in
   * progress, paths, and continue like any other work. It deliberately does
   * NOT create a review schedule: there is no code to re-run and the answer
   * is one query — re-asking it on an interval would be recall theatre, not
   * recall. If the form ever earns a review shape of its own, it goes
   * through the session flow, not around it.
   */
  if (passed(result.value)) {
    const session = await store.load(id)
    if (session) {
      const db = createDatabaseFromEnv()
      await db
        .insert(userProgress)
        .values({
          userId,
          exerciseId: session.exerciseId,
          isCompleted: true,
          attempts: 1,
          completedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [userProgress.userId, userProgress.exerciseId],
          set: { isCompleted: true, completedAt: new Date(), updatedAt: new Date() },
        })
        .catch(() => {
          // The grade already happened; a failed bookkeeping write must not
          // turn a correct answer into an error page.
        })
    }
  }

  return result.value
})
