import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The reading endpoints, asserted at the source.
 *
 * Same reason as `ai-explain.test.ts`: the failures these guard against all
 * return 200. A detail endpoint that ships the rubric renders a page that looks
 * exactly right and turns the exercise into a copying task; a submit route that
 * records an attempt before the grader answers charges someone for nothing. No
 * behaviour test would call either of them wrong.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf-8')

/** Source with comments removed — a doc comment may say what code must not do. */
function code(source: string): string {
  return source
    .split('\n')
    .filter((line) => {
      const trimmed = line.trimStart()
      return !trimmed.startsWith('*') && !trimmed.startsWith('/*') && !trimmed.startsWith('//')
    })
    .join('\n')
}

const DETAIL = 'server/routes/api/reading/[slug].get.ts'
const INDEX = 'server/routes/api/reading/index.get.ts'
const SUBMIT = 'server/routes/api/reading/[slug]/submit.post.ts'

describe('the reading detail endpoint', () => {
  const source = read(DETAIL)

  it('never selects the rubric', () => {
    // The rubric is the answer key. This is the one property of the feature
    // that is not recoverable once it is wrong: a leaked rubric is a graded
    // exercise everybody passes.
    expect(code(source)).not.toContain('rubric')
  })

  it('names its columns instead of selecting the row', () => {
    // A relational query on this table (`db.query.readingExercises.findFirst`)
    // returns every column unless `columns` is given, which is exactly how the
    // answer key comes back the next time somebody edits this file. A `select`
    // with the columns spelled out cannot do that by accident.
    expect(source).toContain('.select({')
    expect(code(source)).not.toContain('query.readingExercises')
    expect(source).toContain('files: readingExercises.files')
  })

  it('serves only published exercises', () => {
    expect(source).toContain('eq(readingExercises.isPublished, true)')
  })

  it('404s an unknown slug', () => {
    expect(source).toContain('statusCode: 404')
  })

  it('reads without a session and adds the marks with one', () => {
    // The codebase is public; whose attempts they are is not.
    expect(source).toContain('requireUserId')
    expect(source).toContain('userId = null')
    expect(source).toContain('eq(readingSubmissions.userId, userId)')
  })
})

describe('the reading list endpoint', () => {
  const source = read(INDEX)

  it('never selects the rubric', () => {
    expect(code(source)).not.toContain('rubric')
  })

  it('counts the files in Postgres rather than shipping them', () => {
    expect(source).toContain('jsonb_array_length')
    expect(source).not.toContain('files: readingExercises.files')
  })

  it('serves only published exercises', () => {
    expect(source).toContain('eq(readingExercises.isPublished, true)')
  })
})

describe('the reading submit endpoint', () => {
  const source = read(SUBMIT)
  const body = code(source)

  it('requires a session', () => {
    expect(source).toContain('requireUserId')
  })

  it('degrades to a clear error when the gateway is not configured', () => {
    // Copied from the explain route, including the OIDC fallback Vercel uses.
    expect(source).toContain('AI_GATEWAY_API_KEY')
    expect(source).toContain('VERCEL_OIDC_TOKEN')
    expect(source).toContain('statusCode: 503')
  })

  it('spends the same budget as the AI explanation it is priced like', () => {
    expect(source).toContain('GRADE_USAGE_KIND')
    expect(source).toContain('gradeBudget')
    expect(source).toContain('statusCode: 429')
    // Not a private counter in this module — that was the bug the usage table
    // exists to have fixed.
    expect(source).not.toContain('new Map<string, number[]>')
  })

  it('picks the model from the user tier, entitlement enforced', () => {
    expect(source).toContain('resolveAiModel(user?.aiModel, budget.paid)')
  })

  it('computes the score from the authored weights', () => {
    // Never from the reply. A model that scores itself can award anything.
    expect(source).toContain('scoreOf(results)')
    expect(source).toContain('maxScoreOf(exercise.rubric)')
    expect(body).not.toContain('answer.score')
  })

  it('retries a malformed answer exactly once', () => {
    expect(source).toContain('const ATTEMPTS = 2')
    expect(source).toContain('parseGraderOutput')
  })

  it('records nothing when the grader never answered cleanly', () => {
    // Source order is the assertion: the 502 has to be thrown before anything
    // is written, or a failed grade still costs an attempt.
    const refusal = body.indexOf('statusCode: 502')
    const insert = body.indexOf('db.insert(readingSubmissions)')
    const meter = body.indexOf('record(db, userId')
    expect(refusal).toBeGreaterThan(-1)
    expect(insert).toBeGreaterThan(refusal)
    expect(meter).toBeGreaterThan(refusal)
    expect(source).toContain('The grader did not answer cleanly — try again')
  })

  it('meters the call only once it produced a grade', () => {
    const insert = body.indexOf('db.insert(readingSubmissions)')
    const meter = body.indexOf('record(db, userId')
    expect(meter).toBeGreaterThan(insert)
  })
})

/**
 * The page holds the other half of the deal: the misses are shown. Hiding them
 * would make the grade a verdict with no lesson in it, which is the failure
 * mode this whole form exists to avoid.
 */
describe('the reading page shows what was missed', () => {
  const ledger = read('components/reading/rubric-ledger.vue')
  const page = read('pages/reading/[slug].vue')

  it('renders every result, hit or not', () => {
    expect(ledger).toContain('v-for="result in results"')
    expect(ledger).toContain("result.hit ? 'found' : 'missed'")
    expect(ledger).toContain('{{ result.point }}')
    expect(ledger).toContain('{{ result.note }}')
  })

  it('offers the second attempt in words', () => {
    expect(page).toContain('Read it again, then try once more')
  })

  it('says what is left before the button is pressed', () => {
    expect(page).toContain('quotaLine')
  })

  it('requires a session', () => {
    expect(page).toContain('requiresAuth: true')
  })
})
