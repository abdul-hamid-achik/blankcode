import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * `createAndExecute` used to be a lie: it inserted a `pending` row and
 * returned, and a separate worker process polled Postgres for it. The name
 * claimed execution; the body did not. Nothing in the type system objected,
 * and nothing in the test suite did either.
 *
 * These are structural tests over the source, because the failure they guard
 * is an *absence* — the behaviour tests all passed while the submission was
 * never run. A mocked service test cannot see a missing call.
 */

const SRC = join(process.cwd(), 'src')
const service = readFileSync(join(SRC, 'modules/submissions/submissions.service.ts'), 'utf-8')

describe('createAndExecute', () => {
  it('actually executes, rather than parking a pending row', () => {
    const body = service.slice(service.indexOf('createAndExecute:'))
    expect(body).toContain('runSubmission(')
  })

  it('returns the finished submission, not the pending one it inserted', () => {
    // The client renders the verdict from this response; returning the
    // freshly-inserted row would show `pending` for a run that is over.
    const body = service.slice(service.indexOf('createAndExecute:'))
    const readBack = body.indexOf('db.query.submissions.findFirst')
    expect(readBack).toBeGreaterThan(body.indexOf('runSubmission('))
  })

  it('resolves the language from the track, as the worker did', () => {
    // A wrong language silently routes to the wrong executor.
    expect(service).toContain('concept.track.slug')
    expect(service).toContain('with: { concept: { with: { track: true } } }')
  })
})

describe('runSubmission', () => {
  const source = readFileSync(join(SRC, 'modules/submissions/run-submission.ts'), 'utf-8')

  it('records failures on the row instead of throwing at the request', () => {
    // A sandbox that dies is a result the learner has to see. If this escaped
    // as a 500 the row would sit in `running` forever, exactly the stuck state
    // the worker's reaper existed to clean up.
    expect(source).toContain('catch (error)')
    expect(source).toContain("status: 'error'")
  })

  it('schedules the next review on both verdicts', () => {
    // Passing and failing both move the SM-2 schedule; only the interval
    // differs. Dropping the failing branch would quietly stop resurfacing
    // the exercises the learner is worst at.
    const passing = source.indexOf('scheduleReview(db, userId, exerciseId, true)')
    const failing = source.indexOf('scheduleReview(db, userId, exerciseId, false)')
    expect(passing).toBeGreaterThan(-1)
    expect(failing).toBeGreaterThan(-1)
  })

  it('only counts an exercise complete when it passed', () => {
    const completed = source.indexOf('markExerciseCompleted')
    const failedBranch = source.indexOf("} else if (result.status === 'failed')")
    expect(completed).toBeLessThan(failedBranch)
  })
})

describe('the worker is gone', () => {
  it('no source still imports it', () => {
    // Left behind, it would keep claiming rows that the request already ran.
    const { existsSync } = require('node:fs') as typeof import('node:fs')
    expect(existsSync(join(SRC, 'workers'))).toBe(false)
    expect(existsSync(join(SRC, 'workflows'))).toBe(false)
  })
})
