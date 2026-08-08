import { createDatabaseFromEnv } from '@blankcode/db/client'
import * as schema from '@blankcode/db/schema'
import { hasPaidAccess } from '@blankcode/shared'
import { withinBudget } from '../../../utils/usage'
import { resolveAiModel } from '../../../utils/ai-model'
import { streamText } from 'ai'
import { eq } from 'drizzle-orm'
import * as jose from 'jose'

/**
 * Explains why a submission failed, streamed.
 *
 * A learner who fails a blank sees a red test name. That tells them *that* they
 * are wrong, which the SM-2 scheduler already uses — but not *why*, and the gap
 * between those two is where people give up. This is the one place a model
 * genuinely helps: turning a stack trace into a sentence about the concept.
 *
 * A specific route rather than part of the Effect API, because it streams:
 * Nitro's radix router prefers this over the `/api/**` catch-all, and the AI
 * SDK's stream response passes straight through.
 *
 * Deliberately does NOT reveal the solution. The exercise is worth nothing if
 * the hint is the answer, so the model is given the learner's code and the
 * failure, never `solutionCode`.
 */

/**
 * Per-user budget. Generation is the only part of a submission that costs money.
 *
 * Counted in the database rather than in this module. It used to be a Map here,
 * which meant each function instance enforced its own copy of the limit: the
 * real ceiling was twenty an hour times however many instances were warm, and a
 * cold start reset it to zero.
 */
const WINDOW_MS = 60 * 60 * 1000
const MAX_PER_WINDOW = 20

export default defineEventHandler(async (event) => {
  if (!process.env['AI_GATEWAY_API_KEY'] && !process.env['VERCEL_OIDC_TOKEN']) {
    throw createError({ statusCode: 503, statusMessage: 'AI is not configured' })
  }

  const authorization = getHeader(event, 'authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null
  if (!token) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  let userId: string
  try {
    const verified = await jose.jwtVerify(
      token,
      new TextEncoder().encode(process.env['JWT_SECRET'] ?? '')
    )
    if (!verified.payload.sub) throw new Error('no subject')
    userId = verified.payload.sub
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const db = createDatabaseFromEnv()

  if (!(await withinBudget(db, userId, 'ai_explain', MAX_PER_WINDOW, WINDOW_MS))) {
    throw createError({ statusCode: 429, statusMessage: 'Too many explanations, try later' })
  }

  // The caller's tier, entitlement-checked: `resolveAiModel` falls back to
  // Standard when `advanced` is stored without a paid plan, so a lapsed
  // subscription degrades the explanation rather than breaking the route.
  const explainer = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { aiModel: true, subscriptionStatus: true, subscriptionEndsAt: true },
  })
  const paid = hasPaidAccess(
    {
      subscriptionStatus: explainer?.subscriptionStatus ?? null,
      subscriptionEndsAt: explainer?.subscriptionEndsAt ?? null,
    },
    new Date()
  )
  const model = resolveAiModel(explainer?.aiModel, paid)

  const body = await readBody<{ submissionId?: string }>(event)
  if (!body?.submissionId) {
    throw createError({ statusCode: 400, statusMessage: 'submissionId is required' })
  }

  const submission = await db.query.submissions.findFirst({
    where: eq(schema.submissions.id, body.submissionId),
    with: { exercise: true },
  })

  // Checked against the caller, not just existence: a submission id is a uuid,
  // but guessing one should still not read somebody else's attempt.
  if (!submission || submission.userId !== userId) {
    throw createError({ statusCode: 404, statusMessage: 'Submission not found' })
  }

  if (submission.status === 'passed') {
    throw createError({ statusCode: 400, statusMessage: 'That submission passed' })
  }

  const failures = (submission.testResults ?? [])
    .filter((test: { passed: boolean }) => !test.passed)
    .map(
      (test: { name: string; message: string | null }) => `- ${test.name}: ${test.message ?? ''}`
    )
    .join('\n')

  const result = streamText({
    model,
    // The exercise's own description is included; its solution never is.
    system: [
      'You explain why a piece of code failed its tests, to someone practising a',
      'language they already know but have not used recently.',
      '',
      'Rules:',
      '- Never write the corrected code. Name the concept and the mistake.',
      '- Two short paragraphs at most.',
      '- If the failure is a typo or a missing import, say so plainly and stop.',
      '- Address the specific failing assertion, not the topic in general.',
    ].join('\n'),
    prompt: [
      `Exercise: ${submission.exercise.title}`,
      `Description: ${submission.exercise.description}`,
      '',
      'Their code:',
      '```',
      submission.code,
      '```',
      '',
      submission.errorMessage ? `Error:\n${submission.errorMessage}` : '',
      failures ? `Failing tests:\n${failures}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    providerOptions: {
      gateway: { tags: ['app:blankcode', 'feature:explain-failure'] },
    },
  })

  return result.toTextStreamResponse()
})
