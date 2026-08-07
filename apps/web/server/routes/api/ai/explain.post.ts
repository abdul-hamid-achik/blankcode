import { createDatabaseFromEnv } from '@blankcode/db/client'
import * as schema from '@blankcode/db/schema'
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

const MODEL = process.env['LLM_MODEL'] ?? 'deepseek/deepseek-v4-flash'

/** Per-user budget. Generation is the only part of a submission that costs money. */
const WINDOW_MS = 60 * 60 * 1000
const MAX_PER_WINDOW = 20
const requests = new Map<string, number[]>()

function withinBudget(userId: string): boolean {
  const now = Date.now()
  const recent = (requests.get(userId) ?? []).filter((at) => at > now - WINDOW_MS)
  if (recent.length >= MAX_PER_WINDOW) return false
  recent.push(now)
  requests.set(userId, recent)
  // Bounded so a stream of one-off users cannot grow this without limit.
  if (requests.size > 10_000) {
    for (const [key, times] of requests) {
      if (times.every((at) => at <= now - WINDOW_MS)) requests.delete(key)
    }
  }
  return true
}

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

  if (!withinBudget(userId)) {
    throw createError({ statusCode: 429, statusMessage: 'Too many explanations, try later' })
  }

  const body = await readBody<{ submissionId?: string }>(event)
  if (!body?.submissionId) {
    throw createError({ statusCode: 400, statusMessage: 'submissionId is required' })
  }

  const db = createDatabaseFromEnv()
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
    model: MODEL,
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
