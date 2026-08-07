import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The explain endpoint is the first place a model sees an exercise, and the
 * exercise is worth nothing if the hint is the answer.
 *
 * Source-level assertions because the failure would be silent: an endpoint that
 * leaks `solutionCode` still returns a helpful-looking explanation, and no
 * behaviour test would call it wrong. The same reason `redact.ts` has one.
 */

const ROUTE = join(process.cwd(), 'server/routes/api/ai/explain.post.ts')
const source = readFileSync(ROUTE, 'utf-8')

describe('the explain endpoint', () => {
  it('never puts the solution in the prompt', () => {
    // The doc comment says it does not; this is what makes that true.
    const code = source
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('/*'))
      .join('\n')
    expect(code).not.toContain('solutionCode')
    expect(code).not.toContain('blanks')
  })

  it('requires a bearer token', () => {
    expect(source).toContain('jwtVerify')
    expect(source).toContain('statusCode: 401')
  })

  it('checks the submission belongs to the caller', () => {
    // Existence alone is not enough: ids are guessable in principle, and one
    // learner reading another's attempt is a real leak.
    expect(source).toContain('submission.userId !== userId')
  })

  it('refuses to explain a submission that passed', () => {
    expect(source).toContain("submission.status === 'passed'")
  })

  it('has a per-user budget', () => {
    // Every other part of a submission is fixed cost; this one is not.
    expect(source).toContain('withinBudget')
    expect(source).toContain('MAX_PER_WINDOW')
  })

  it('bounds the budget map so it cannot grow forever', () => {
    expect(source).toContain('requests.size >')
    expect(source).toContain('requests.delete')
  })

  it('degrades to a clear error when the gateway is not configured', () => {
    expect(source).toContain('AI_GATEWAY_API_KEY')
    expect(source).toContain('statusCode: 503')
  })

  it('tags its spend so the gateway bill can be attributed', () => {
    expect(source).toContain('feature:explain-failure')
  })
})
