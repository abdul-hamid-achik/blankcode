import { randomUUID } from 'node:crypto'
import { executionService } from '@blankcode/api/execution'
import { createDatabaseFromEnv } from '@blankcode/db/client'
import { concepts, customDrills, exercises, submissions, users } from '@blankcode/db/schema'
import { generateText } from 'ai'
import { and, count, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import { resolveAiModel } from '../../../utils/ai-model'
import { requireUserId } from '../../../utils/auth'
import {
  buildDrillPrompt,
  buildEvidence,
  DRILL_USAGE_KIND,
  DRILL_WINDOW_MS,
  drillBudget,
  EVIDENCE_WINDOW_DAYS,
  MAX_EVIDENCE_FAILURES,
  parseDrillOutput,
  redactDrill,
  validateConceptSlug,
  validateDrill,
  type ValidatedDrill,
} from '../../../utils/drill-generator'
import { countSince, record } from '../../../utils/usage'

/**
 * Generates one drill from the caller's own weak spot, and refuses to store it
 * unless it passes its own tests.
 *
 * This is the loop closing: everything else on the site tells a learner where
 * they are weak, and this is the first thing that does something about it
 * without a human authoring an exercise first. Which is exactly why it is the
 * most dangerous feature here — a model writing practice material fails in the
 * way this codebase has been burned by repeatedly, by producing something that
 * reads perfectly and does not run.
 *
 * So the drill is executed before it exists. `stripBlankMarkers` gives the
 * complete solution, the generated suite runs against it in the real sandbox,
 * and only `status === 'passed'` is allowed to become a row. A drill whose
 * canonical answer fails its own tests is unsolvable by construction: the
 * learner would type the right thing and be told they are wrong, with no way to
 * find out otherwise.
 *
 * Two attempts, then nothing, and nothing is metered. A generator that could
 * not produce a working drill has cost the learner their day's allowance for
 * an empty page, which is the one outcome worth spending an extra gateway call
 * to avoid.
 */

/** Model, then sandbox. Twice at most. */
const ATTEMPTS = 2

export default defineEventHandler(async (event) => {
  if (!process.env['AI_GATEWAY_API_KEY'] && !process.env['VERCEL_OIDC_TOKEN']) {
    throw createError({ statusCode: 503, statusMessage: 'AI is not configured' })
  }

  const userId = await requireUserId(event)

  const body = await readBody<{ conceptSlug?: unknown }>(event)
  const conceptSlug = validateConceptSlug(body?.conceptSlug)
  if (conceptSlug === null) {
    throw createError({ statusCode: 400, statusMessage: 'conceptSlug is required' })
  }

  const db = createDatabaseFromEnv()

  /*
   * The budget is settled before anything else runs.
   *
   * Not because the order is tidy: a generation is a gateway call plus up to
   * two sandbox boots, and every one of those is spent before the response can
   * possibly say "you are over your limit". Checking afterwards would enforce
   * the ceiling on what the learner sees and not on what it costs.
   */
  const [user, usedToday] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { aiModel: true, subscriptionStatus: true, subscriptionEndsAt: true },
    }),
    countSince(db, userId, DRILL_USAGE_KIND, DRILL_WINDOW_MS),
  ])

  const budget = drillBudget(
    {
      subscriptionStatus: user?.subscriptionStatus ?? null,
      subscriptionEndsAt: user?.subscriptionEndsAt ?? null,
    },
    usedToday
  )
  if (!budget.allowed) {
    throw createError({ statusCode: 429, statusMessage: budget.message ?? 'Budget reached' })
  }

  const model = resolveAiModel(user?.aiModel, budget.paid)

  const concept = await db.query.concepts.findFirst({
    where: eq(concepts.slug, conceptSlug),
    columns: { id: true, slug: true, name: true },
    with: { track: { columns: { slug: true } } },
  })
  if (!concept) {
    throw createError({ statusCode: 404, statusMessage: 'That concept does not exist' })
  }

  const trackSlug = concept.track.slug

  /*
   * The evidence: the same thirty-day window the weak-spots endpoint
   * aggregates over, so the share stored on the drill is the share the row
   * they clicked was showing.
   *
   * A concept with no failures is still allowed through. Somebody may want a
   * drill on something they have never touched, and refusing would make the
   * feature reachable only from a list they cannot get onto — the evidence
   * block simply says there is nothing to go on.
   */
  const since = new Date(Date.now() - EVIDENCE_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const inWindow = and(
    eq(submissions.userId, userId),
    eq(exercises.conceptId, concept.id),
    gte(submissions.createdAt, since)
  )

  const [totalsRows, recentFailures] = await Promise.all([
    db
      .select({
        attempts: count(),
        failed: sql<number>`count(*) filter (where ${submissions.status} in ('failed', 'error'))`,
      })
      .from(submissions)
      .innerJoin(exercises, eq(submissions.exerciseId, exercises.id))
      .where(inWindow),
    db
      .select({
        exerciseTitle: exercises.title,
        code: submissions.code,
        errorMessage: submissions.errorMessage,
      })
      .from(submissions)
      .innerJoin(exercises, eq(submissions.exerciseId, exercises.id))
      .where(and(inWindow, inArray(submissions.status, ['failed', 'error'])))
      .orderBy(desc(submissions.createdAt))
      .limit(MAX_EVIDENCE_FAILURES),
  ])

  const totals = totalsRows[0]
  const evidence = buildEvidence({
    attempts: totals ? Number(totals.attempts) : 0,
    failed: totals ? Number(totals.failed) : 0,
    failures: recentFailures,
  })

  /*
   * Two goes at a drill that runs.
   *
   * `repair` carries the exact reason the last one was rejected — a validation
   * message, a red test name, or a thrown gateway error — back into the next
   * prompt. Asking again in the same words gets the same drill; telling the
   * model that its `___blank_start___ x ___blank_end___` was padded, or that
   * `TestDivide` failed, gets a different one.
   */
  let drill: ValidatedDrill | null = null
  let repair: string | undefined

  for (let attempt = 0; attempt < ATTEMPTS && drill === null; attempt++) {
    const { system, prompt } = buildDrillPrompt({
      conceptName: concept.name,
      trackSlug,
      evidence,
      repair,
    })

    try {
      // No temperature pinned, unlike the grader: grading the same explanation
      // twice must give the same score, but "generate another drill for this
      // concept" returning the identical drill is the feature not working.
      const answer = await generateText({
        model,
        system,
        prompt,
        providerOptions: {
          gateway: { tags: ['app:blankcode', 'feature:drill-generate'] },
        },
      })

      const candidate = parseDrillOutput(answer.text)
      if (candidate === null) {
        repair =
          'the reply was not a JSON object with title, description, code and testCode as strings'
        continue
      }

      const checked = validateDrill(candidate)
      if (!checked.ok) {
        repair = checked.reason
        continue
      }

      /*
       * The only check that counts. Everything above is structure; this is the
       * question of whether the thing works, asked of the same sandbox that
       * runs every real submission, with the markers stripped so what executes
       * is exactly what a learner who filled every blank correctly would
       * submit.
       */
      const run = await executionService.execute(
        randomUUID(),
        randomUUID(),
        checked.drill.solutionCode,
        checked.drill.testCode,
        trackSlug
      )

      if (run.status !== 'passed') {
        const failures = run.testResults
          .filter((test) => !test.passed)
          .map((test) => `- ${test.name}: ${test.message ?? ''}`)
          .join('\n')
        repair = [
          'your own solution did not pass the tests you wrote for it',
          run.errorMessage ?? '',
          failures,
        ]
          .filter((line) => line !== '')
          .join('\n')
        continue
      }

      drill = checked.drill
    } catch (error) {
      console.error(
        `[drills] generating ${conceptSlug} failed on attempt ${attempt + 1}:`,
        String(error)
      )
      repair = `the attempt failed outright: ${String(error)}`
    }
  }

  if (drill === null) {
    // Nothing written: no drill, no usage event. Two gateway calls and up to
    // two sandbox boots were ours to waste, not theirs.
    throw createError({
      statusCode: 502,
      statusMessage:
        'The generator did not produce a drill that passes its own tests — nothing was saved',
    })
  }

  const [row] = await db
    .insert(customDrills)
    .values({
      userId,
      conceptSlug: concept.slug,
      trackSlug,
      language: trackSlug,
      title: drill.title,
      description: drill.description,
      starterCode: drill.starterCode,
      solutionCode: drill.solutionCode,
      testCode: drill.testCode,
      // From `generateStarterCode`, so the offsets index the starter that is
      // stored beside them rather than the solution they came out of.
      blanks: drill.blanks,
      source: {
        failedShare: evidence.failedShare,
        attempts: evidence.attempts,
        window: evidence.window,
      },
      model,
    })
    .returning()

  if (!row) {
    throw createError({ statusCode: 500, statusMessage: 'Could not save the drill' })
  }

  await record(db, userId, DRILL_USAGE_KIND)

  return {
    drill: redactDrill(row),
    quota: {
      paid: budget.paid,
      dailyLimit: budget.dailyLimit,
      remainingToday:
        budget.remainingToday === null ? null : Math.max(0, budget.remainingToday - 1),
    },
  }
})
