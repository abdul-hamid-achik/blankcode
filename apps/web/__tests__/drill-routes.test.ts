import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The drill endpoints, asserted at the source.
 *
 * Same argument as `reading-routes.test.ts` and `redact.test.ts`: every failure
 * guarded against here returns 200. A detail route that selects `solution_code`
 * renders a drill page that looks exactly right and has the answer sitting in
 * the Network tab. A generate route that meters before it knows the drill runs
 * charges someone their whole day for a 502. Neither is a behaviour a test
 * calling the endpoint would call wrong.
 *
 * `custom_drills` is the reason this file is stricter than it looks. The table
 * carries `solution_code`, `test_code` and every blank's `solution` in one row,
 * so a `db.query.customDrills.findMany()` with no `columns` — the shape you get
 * by writing the obvious thing — returns the answer key. Both read routes name
 * their columns, and these tests are what keeps that true.
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

const GENERATE = 'server/routes/api/drills/generate.post.ts'
const LIST = 'server/routes/api/drills/index.get.ts'
const DETAIL = 'server/routes/api/drills/[id].get.ts'
const ATTEMPT = 'server/routes/api/drills/[id]/attempt.post.ts'
const PIPELINE = 'server/utils/drill-generator.ts'

describe('the drill list endpoint', () => {
  const source = read(LIST)
  const body = code(source)

  it('requires a session and filters by it', () => {
    expect(source).toContain('requireUserId')
    expect(body).toContain('eq(customDrills.userId, userId)')
  })

  it('never selects the answer', () => {
    expect(body).not.toContain('solutionCode')
    expect(body).not.toContain('testCode')
  })

  it('names its columns instead of returning the row', () => {
    // A relational query returns every column unless `columns` is given, which
    // is exactly how the answer key comes back next time somebody edits this.
    expect(source).toContain('.select({')
    expect(body).not.toContain('query.customDrills')
  })

  it('does not ship the starter or the blanks to a list of titles', () => {
    expect(body).not.toContain('customDrills.starterCode')
    expect(body).not.toContain('customDrills.blanks')
    expect(source).toContain('redactDrillListItem')
  })
})

describe('the drill detail endpoint', () => {
  const source = read(DETAIL)
  const body = code(source)

  it('requires a session', () => {
    expect(source).toContain('requireUserId')
  })

  it('never selects the answer', () => {
    expect(body).not.toContain('customDrills.solutionCode')
    expect(body).not.toContain('customDrills.testCode')
  })

  it('names its columns instead of returning the row', () => {
    expect(source).toContain('.select({')
    expect(body).not.toContain('query.customDrills')
  })

  it('passes everything it returns through the redactor', () => {
    expect(source).toContain('redactDrill(row)')
  })

  it('checks ownership in the query rather than after the read', () => {
    expect(body).toContain('eq(customDrills.userId, userId)')
  })

  it("answers 404 for somebody else's drill and for a malformed id alike", () => {
    expect(source).toContain('isDrillId')
    expect(source).toContain('statusCode: 404')
  })
})

describe('the drill attempt endpoint', () => {
  const source = read(ATTEMPT)
  const body = code(source)

  it("grades with the exercise path's own function", () => {
    // Not a private compare in this file. Two implementations of "correct" is
    // how a drill's canonical answer passes in one place and fails in the other.
    expect(source).toContain('gradeBlanks')
    expect(source).toContain('reconstructCode')
  })

  it('requires a session and checks ownership in the query', () => {
    expect(source).toContain('requireUserId')
    expect(body).toContain('eq(customDrills.userId, userId)')
  })

  it('never returns the answers it graded against', () => {
    const returned = body.slice(body.indexOf('return {'))
    expect(returned).not.toContain('blanks')
    expect(returned).not.toContain('solution')
    expect(returned).toContain('verdicts')
    expect(returned).toContain('solved')
  })

  it('counts the attempt', () => {
    expect(body).toContain('${customDrills.attempts} + 1')
  })

  it('sets solvedAt once and never overwrites it', () => {
    // A second correct run is a re-read, not the moment it was cracked.
    expect(body).toContain('drill.solvedAt ??')
  })
})

describe('the drill generate endpoint', () => {
  const source = read(GENERATE)
  const body = code(source)

  it('requires a session', () => {
    expect(source).toContain('requireUserId')
  })

  it('degrades to a clear error when the gateway is not configured', () => {
    expect(source).toContain('AI_GATEWAY_API_KEY')
    expect(source).toContain('VERCEL_OIDC_TOKEN')
    expect(source).toContain('statusCode: 503')
  })

  it('settles the budget before it spends anything', () => {
    // Source order is the assertion. A generation is a gateway call plus up to
    // two sandbox boots; checking afterwards limits what is seen, not what is
    // spent.
    const budget = body.indexOf('statusCode: 429')
    const gateway = body.indexOf('generateText(')
    const sandbox = body.indexOf('executionService.execute(')
    expect(budget).toBeGreaterThan(-1)
    expect(gateway).toBeGreaterThan(budget)
    expect(sandbox).toBeGreaterThan(budget)
    expect(source).toContain('DRILL_USAGE_KIND')
    expect(source).toContain('drillBudget')
  })

  it('picks the model from the user tier, entitlement enforced', () => {
    expect(source).toContain('resolveAiModel(user?.aiModel, budget.paid)')
  })

  it('executes the drill before storing it', () => {
    // The rule this whole feature turns on: verify by executing, not by
    // reading. Only a passing run may become a row.
    const sandbox = body.indexOf('executionService.execute(')
    const insert = body.indexOf('db\n    .insert(customDrills)')
    expect(sandbox).toBeGreaterThan(-1)
    expect(insert).toBeGreaterThan(sandbox)
    expect(body).toContain("run.status !== 'passed'")
  })

  it('runs the solution with the markers stripped', () => {
    // The sandbox has to see exactly what a learner who filled every blank
    // correctly would submit, or the run proves nothing about the drill.
    expect(body).toContain('checked.drill.solutionCode')
    expect(body).toContain('checked.drill.testCode')
  })

  it('runs it in the track language', () => {
    expect(body).toContain('trackSlug')
    expect(body).toContain('concept.track.slug')
  })

  it('retries once with the failure fed back', () => {
    expect(source).toContain('const ATTEMPTS = 2')
    expect(body).toContain('repair')
  })

  it('records nothing when no drill passed', () => {
    // Order is the assertion again: the 502 has to be thrown before the insert
    // and before the meter, or a generator that failed still costs the day.
    const refusal = body.indexOf('statusCode: 502')
    const insert = body.indexOf('db\n    .insert(customDrills)')
    const meter = body.indexOf('record(db, userId')
    expect(refusal).toBeGreaterThan(-1)
    expect(insert).toBeGreaterThan(refusal)
    expect(meter).toBeGreaterThan(refusal)
    expect(source).toContain(
      'The generator did not produce a drill that passes its own tests — nothing was saved'
    )
  })

  it('meters only once a drill exists', () => {
    const insert = body.indexOf('db\n    .insert(customDrills)')
    const meter = body.indexOf('record(db, userId')
    expect(meter).toBeGreaterThan(insert)
  })

  it('stores the offsets that index the starter', () => {
    expect(body).toContain('blanks: drill.blanks')
    expect(body).toContain('starterCode: drill.starterCode')
  })

  it('stores the evidence that seeded it', () => {
    expect(body).toContain('failedShare: evidence.failedShare')
    expect(body).toContain('window: evidence.window')
  })

  it('returns the drill redacted', () => {
    expect(body).toContain('redactDrill(row)')
  })

  it('bounds the evidence it pastes into the prompt', () => {
    expect(source).toContain('MAX_EVIDENCE_FAILURES')
    expect(source).toContain('buildEvidence')
  })
})

/**
 * The pipeline keeps its hands off the network, which is the only reason the
 * rules above are testable at all.
 */
describe('the drill pipeline module', () => {
  const source = read(PIPELINE)

  it('has no gateway, no database and no sandbox in it', () => {
    expect(source).not.toContain("from 'ai'")
    expect(source).not.toContain('@blankcode/db')
    expect(source).not.toContain('@blankcode/api/execution')
  })

  it('reuses the exercise format rather than reimplementing it', () => {
    expect(source).toContain('@blankcode/exercise-parser')
    expect(source).toContain('extractBlanks')
    expect(source).toContain('generateStarterCode')
    expect(source).toContain('stripBlankMarkers')
  })
})

/**
 * The two pages, and the one affordance that reaches them from where the
 * weakness is named.
 */
describe('the drill pages', () => {
  const ledger = read('pages/drills/index.vue')
  const detail = read('pages/drills/[id].vue')
  const weakSpots = read('components/progress/weak-spots.vue')
  const sidebar = read('components/layout/app-sidebar.vue')

  it('both require a session', () => {
    expect(ledger).toContain('requiresAuth: true')
    expect(detail).toContain('requiresAuth: true')
  })

  it('the ledger offers an action when it is empty', () => {
    expect(ledger).toContain('/dashboard')
  })

  it('the drill page says why the drill exists', () => {
    expect(detail).toContain('Generated from your last 30 days on')
    expect(detail).toContain('% failed')
  })

  it('the drill page never asks for the answers', () => {
    // The starter and the placeholders are all it gets; the verdicts come back
    // from the attempt endpoint.
    expect(detail).not.toContain('solutionCode')
    expect(detail).not.toContain('blank.solution')
  })

  it('the drill page offers another drill for the same concept once solved', () => {
    expect(detail).toContain('generate another for this concept')
  })

  it('the weak-spots list can turn a weakness into a drill', () => {
    expect(weakSpots).toContain('drill this')
    expect(weakSpots).toContain('/api/drills/generate')
    expect(weakSpots).toContain('conceptSlug')
  })

  it('the weak-spots list says what the wait is for', () => {
    // "Generating…" would be a lie by omission: the sandbox run is most of the
    // wait, and it is the part worth waiting for.
    expect(weakSpots).toContain('it must pass its own tests before you see it')
  })

  it('the sidebar links to the drills', () => {
    expect(sidebar).toContain("{ to: '/drills', label: 'Drills' }")
  })
})
