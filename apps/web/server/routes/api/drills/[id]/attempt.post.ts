import { createDatabaseFromEnv } from '@blankcode/db/client'
import { customDrills } from '@blankcode/db/schema'
import { gradeBlanks, reconstructCode } from '@blankcode/shared'
import { and, eq, sql } from 'drizzle-orm'
import { requireUserId } from '../../../../utils/auth'
import { isDrillId, validateAnswers } from '../../../../utils/drill-generator'

/**
 * Grades a filled-in drill.
 *
 * Server-side for the same reason exercise blanks are: the comparison needs
 * each blank's `solution`, and shipping that to the browser hands over the
 * answer. `gradeBlanks` is the exercise path's own function, reached the same
 * way — reconstruct the full source from the starter and what was typed, then
 * re-extract and compare — so a drill and an exercise cannot disagree about
 * what "correct" means.
 *
 * There is no sandbox run here, and that is deliberate. The drill's solution
 * already passed its tests before the row existed, which is what makes an exact
 * compare against it meaningful; running the learner's version would spend a
 * microVM to re-answer a question that was settled at generation time.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)

  const id = getRouterParam(event, 'id') ?? ''
  if (!isDrillId(id)) {
    throw createError({ statusCode: 404, statusMessage: 'Drill not found' })
  }

  const body = await readBody<{ answers?: unknown }>(event)
  const answers = validateAnswers(body?.answers)
  if (answers === null) {
    throw createError({
      statusCode: 400,
      statusMessage: 'answers must be an object of blank id to string',
    })
  }

  const db = createDatabaseFromEnv()

  const [drill] = await db
    .select({
      id: customDrills.id,
      starterCode: customDrills.starterCode,
      blanks: customDrills.blanks,
      attempts: customDrills.attempts,
      solvedAt: customDrills.solvedAt,
    })
    .from(customDrills)
    .where(and(eq(customDrills.id, id), eq(customDrills.userId, userId)))
    .limit(1)

  if (!drill) {
    throw createError({ statusCode: 404, statusMessage: 'Drill not found' })
  }

  const blanks = drill.blanks ?? []
  if (blanks.length === 0) {
    throw createError({ statusCode: 409, statusMessage: 'That drill has no blanks to grade' })
  }

  // Unanswered blanks keep their placeholder, exactly as the editor submits
  // them — an empty string would shift every later offset and make the
  // extraction disagree with the starter it was built from.
  const values = new Map(blanks.map((blank) => [blank.id, answers[blank.id] ?? blank.placeholder]))
  const submitted = reconstructCode(drill.starterCode, blanks, values)

  const verdicts = gradeBlanks(submitted, drill.starterCode, blanks)
  if (verdicts === null) {
    // The reconstruction no longer lines up with the starter. Reporting every
    // blank wrong would be a verdict about this code path rather than about
    // their answers.
    throw createError({
      statusCode: 409,
      statusMessage: 'That drill could not be graded — its starter and blanks disagree',
    })
  }

  const solved = blanks.every((blank) => verdicts[blank.id] === 'correct')

  /*
   * The attempt counts either way, and `solvedAt` is only ever set once. A
   * second correct run of an already-solved drill is a re-read, not the moment
   * it was cracked, and overwriting the date would quietly erase that.
   */
  const solvedAt = drill.solvedAt ?? (solved ? new Date() : null)

  await db
    .update(customDrills)
    .set({
      attempts: sql`${customDrills.attempts} + 1`,
      ...(solvedAt === null ? {} : { solvedAt }),
    })
    .where(eq(customDrills.id, drill.id))

  return {
    verdicts,
    solved,
    attempts: drill.attempts + 1,
    solvedAt,
  }
})
