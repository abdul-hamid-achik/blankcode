import { gradeBlanks, reconstructCode } from '@blankcode/shared'
import { describe, expect, it } from 'vitest'
import {
  buildDrillPrompt,
  buildEvidence,
  describeBlankProblem,
  drillBudget,
  FREE_DAILY_DRILLS,
  isDrillId,
  isHollowReflection,
  MAX_BLANK_CHARS,
  MAX_EVIDENCE_CODE_CHARS,
  PAID_DAILY_DRILLS,
  parseDrillOutput,
  redactDrill,
  redactDrillListItem,
  smoothedFailureShare,
  truncateCode,
  validateAnswers,
  validateConceptSlug,
  validateDrill,
} from '../server/utils/drill-generator'

/**
 * The drill pipeline, tested where it is decidable.
 *
 * A generated drill has two ways to be wrong and only one of them throws. It
 * can fail to run — caught by the sandbox, in production, by the route — or it
 * can run perfectly and be unsolvable: a blank whose answer contains a quote, a
 * marker padded with a space so the stored offsets grade a different span than
 * the one the learner types into. That second class is what this file exists
 * for. Every one of those produces a page that looks completely correct and
 * tells a learner who typed the right answer that they are wrong.
 */

/** A minimal drill that obeys every rule, for the cases that need a valid one. */
const GOOD = {
  title: 'Widening a number to a string',
  description: 'Two spots carry the whole idea. Watch what the second one returns.',
  code: [
    'function double(n: number): number {',
    '  return n * ___blank_start___2___blank_end___',
    '}',
    '',
    'const label = ___blank_start___String___blank_end___(double(21))',
  ].join('\n'),
  testCode:
    "import { expect, test } from 'vitest'\n\ntest('doubles', () => {\n  expect(double(21)).toBe(42)\n})",
}

describe('drillBudget', () => {
  const free = { subscriptionStatus: null, subscriptionEndsAt: null }
  const paid = { subscriptionStatus: 'active', subscriptionEndsAt: null }

  it('gives a free account one a day', () => {
    expect(FREE_DAILY_DRILLS).toBe(1)
    expect(drillBudget(free, 0).allowed).toBe(true)
    expect(drillBudget(free, 1).allowed).toBe(false)
  })

  it('says what the free plan is, in words, when it refuses', () => {
    // The learner is told the rule, not that "a limit was reached". They have
    // to be able to tell a spent allowance from a broken feature.
    expect(drillBudget(free, 1).message).toContain('The free plan generates one drill a day')
    expect(drillBudget(free, 1).message).toContain('rolling 24 hours')
  })

  it('gives a paid account ten a day', () => {
    expect(PAID_DAILY_DRILLS).toBe(10)
    expect(drillBudget(paid, 9).allowed).toBe(true)
    expect(drillBudget(paid, 10).allowed).toBe(false)
    expect(drillBudget(paid, 0).dailyLimit).toBe(10)
  })

  it('counts a lapsed subscription as free', () => {
    const lapsed = { subscriptionStatus: 'canceled', subscriptionEndsAt: new Date('2020-01-01') }
    expect(drillBudget(lapsed, 1, new Date('2026-01-01')).allowed).toBe(false)
  })

  it('allows the request when the count could not be taken', () => {
    // Same choice as usage.ts and the reading grader: this gates spend, not
    // access, and a database blip should not remove the feature for everyone.
    expect(drillBudget(free, null).allowed).toBe(true)
    expect(drillBudget(free, null).remainingToday).toBeNull()
  })

  it('reports what is left', () => {
    expect(drillBudget(paid, 3).remainingToday).toBe(7)
  })
})

describe('describeBlankProblem', () => {
  it('accepts an ordinary token', () => {
    expect(describeBlankProblem('setTimeout')).toBeNull()
    expect(describeBlankProblem('errors.New(err)')).toBeNull()
  })

  it('rejects an empty answer', () => {
    expect(describeBlankProblem('   ')).toContain('empty')
  })

  it('rejects a multi-line answer', () => {
    // A blank renders as a single-line input, so a newline cannot be typed and
    // the feedback is permanently "incorrect".
    expect(describeBlankProblem('if err != nil {\n  return err\n}')).toContain('single line')
  })

  it('rejects an answer past the character cap', () => {
    const long = 'a'.repeat(MAX_BLANK_CHARS + 1)
    expect(describeBlankProblem(long)).toContain(String(MAX_BLANK_CHARS))
  })

  it('accepts an answer exactly at the cap', () => {
    expect(describeBlankProblem('a'.repeat(MAX_BLANK_CHARS))).toBeNull()
  })

  it.each(['"errors"', "'errors'", '`errors`'])('rejects the quote in %s', (answer) => {
    // Grading is an exact trimmed compare, so quote style turns one right
    // answer into one right answer and two false negatives.
    expect(describeBlankProblem(answer)).toContain('quote')
  })

  it.each(['__init__', '_private', 'trailing_'])('rejects the underscore edge in %s', (answer) => {
    // Markers are underscore-delimited: a dunder merges with the marker and
    // `def __init__(self)` parses out as `def __init_(self)`.
    expect(describeBlankProblem(answer)).toContain('underscore')
  })

  it('allows an underscore in the middle', () => {
    expect(describeBlankProblem('snake_case')).toBeNull()
  })
})

describe('validateDrill', () => {
  it('accepts a well-formed drill and returns the pieces the row needs', () => {
    const result = validateDrill(GOOD)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.drill.blanks).toHaveLength(2)
    expect(result.drill.solutionCode).not.toContain('___blank_start___')
    expect(result.drill.starterCode).not.toContain('___blank_start___')
    expect(result.drill.starterCode).not.toContain('String')
  })

  it('stores offsets that index the starter, not the solution', () => {
    // This is the property the whole feature rests on. If the offsets refer to
    // the solution, every blank in the UI is drawn over the wrong span.
    const result = validateDrill(GOOD)
    if (!result.ok) throw new Error(result.reason)

    for (const blank of result.drill.blanks) {
      expect(result.drill.starterCode.slice(blank.from, blank.to)).toBe(blank.placeholder)
    }
  })

  it('rejects fewer than two blanks', () => {
    const one = { ...GOOD, code: 'const a = ___blank_start___1___blank_end___' }
    const result = validateDrill(one)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toContain('1 blanks')
  })

  it('rejects more than four blanks', () => {
    const many = {
      ...GOOD,
      code: Array.from(
        { length: 5 },
        (_, i) => `const a${i} = ___blank_start___${i}___blank_end___`
      ).join('\n'),
    }
    const result = validateDrill(many)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toContain('5 blanks')
  })

  it('rejects an unclosed marker', () => {
    const broken = { ...GOOD, code: `${GOOD.code}\nconst x = ___blank_start___oops` }
    const result = validateDrill(broken)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toContain('did not parse')
  })

  it('rejects markers padded with whitespace', () => {
    /*
     * The subtlest failure in the format and the reason the reconstruction
     * check exists. `extractBlanks` trims the answer but the span it recorded
     * still covers the spaces, so the stored offsets grade a different piece
     * of text than the one shown. Nothing about the drill looks wrong.
     */
    const padded = {
      ...GOOD,
      code: [
        'const a = ___blank_start___ 42 ___blank_end___',
        'const b = ___blank_start___7___blank_end___',
      ].join('\n'),
    }
    const result = validateDrill(padded)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toContain('reconstruct')
  })

  it('rejects a blank that breaks the answer rules', () => {
    const quoted = {
      ...GOOD,
      code: [
        'import ___blank_start___"errors"___blank_end___',
        'const b = ___blank_start___7___blank_end___',
      ].join('\n'),
    }
    const result = validateDrill(quoted)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toContain('quote')
  })

  it.each([
    ['an empty title', { title: '' }, 'title'],
    ['an over-long title', { title: 'x'.repeat(201) }, 'title'],
    ['an empty description', { description: '' }, 'description'],
    ['empty code', { code: '   ' }, 'code'],
    ['an empty test suite', { testCode: '' }, 'test suite'],
  ])('rejects %s', (_label, patch, expected) => {
    const result = validateDrill({ ...GOOD, ...patch })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toContain(expected)
  })
})

describe('parseDrillOutput', () => {
  const payload = JSON.stringify(GOOD)

  it('reads a bare JSON object', () => {
    expect(parseDrillOutput(payload)?.title).toBe(GOOD.title)
  })

  it('reads it out of a markdown fence', () => {
    expect(parseDrillOutput(`\`\`\`json\n${payload}\n\`\`\``)?.title).toBe(GOOD.title)
  })

  it('reads it out of surrounding prose', () => {
    expect(parseDrillOutput(`Here is the drill:\n${payload}\nHope that helps.`)).not.toBeNull()
  })

  it('trims the title and description but never the code', () => {
    const spaced = JSON.stringify({ ...GOOD, title: '  Padded  ', code: `${GOOD.code}\n` })
    const parsed = parseDrillOutput(spaced)
    expect(parsed?.title).toBe('Padded')
    expect(parsed?.code.endsWith('\n')).toBe(true)
  })

  it.each([
    ['a missing field', JSON.stringify({ title: 'x', description: 'y', code: 'z' })],
    ['a non-string field', JSON.stringify({ ...GOOD, testCode: 42 })],
    ['prose only', 'I cannot write that drill.'],
    ['empty', ''],
    ['broken JSON', '{"title": "x",}'],
  ])('returns null for %s', (_label, raw) => {
    expect(parseDrillOutput(raw)).toBeNull()
  })

  it('returns null for anything that is not a string', () => {
    expect(parseDrillOutput(null)).toBeNull()
    expect(parseDrillOutput({ title: 'x' })).toBeNull()
  })
})

describe('buildEvidence', () => {
  it('smooths the failure share the way the dashboard does', () => {
    // (failed + 1) / (attempts + 2) — three of three reads as 0.8, not 1.0.
    expect(smoothedFailureShare(3, 3)).toBeCloseTo(0.8)
    expect(buildEvidence({ attempts: 3, failed: 3, failures: [] }).failedShare).toBeCloseTo(0.8)
  })

  it('keeps at most two failures', () => {
    const failures = Array.from({ length: 5 }, (_, i) => ({
      exerciseTitle: `Exercise ${i}`,
      code: 'x',
      errorMessage: null,
    }))
    expect(buildEvidence({ attempts: 5, failed: 5, failures }).failures).toHaveLength(2)
  })

  it('truncates a large paste', () => {
    const evidence = buildEvidence({
      attempts: 1,
      failed: 1,
      failures: [{ exerciseTitle: 'Big', code: 'a'.repeat(9000), errorMessage: null }],
    })
    expect(evidence.failures[0]!.code.length).toBeLessThan(MAX_EVIDENCE_CODE_CHARS + 40)
    expect(evidence.failures[0]!.code).toContain('truncated')
  })

  it('leaves short code alone', () => {
    expect(truncateCode('const a = 1')).toBe('const a = 1')
  })

  it('records the window it was taken over', () => {
    expect(buildEvidence({ attempts: 0, failed: 0, failures: [] }).window).toBe('30d')
  })

  it('defaults the reflect evidence to empty rather than requiring it', () => {
    const evidence = buildEvidence({ attempts: 0, failed: 0, failures: [] })
    expect(evidence.hollowReflections).toEqual([])
    expect(evidence.unexplainedPasses).toBe(0)
  })

  it('keeps at most two hollow reflections, truncated', () => {
    const hollow = Array.from({ length: 4 }, (_, i) => ({
      exerciseTitle: `Exercise ${i}`,
      question: 'Why is it right?',
      answer: 'x'.repeat(900),
    }))
    const evidence = buildEvidence({
      attempts: 0,
      failed: 0,
      failures: [],
      hollowReflections: hollow,
    })
    expect(evidence.hollowReflections).toHaveLength(2)
    expect(evidence.hollowReflections[0]!.answer.length).toBeLessThan(340)
  })
})

describe('isHollowReflection', () => {
  it('matches the schedule: short answers are hollow, real ones are not', () => {
    expect(isHollowReflection('makes sense')).toBe(true)
    expect(isHollowReflection(' '.repeat(80))).toBe(true)
    expect(
      isHollowReflection(
        'The %v verb formatted the error into text, so errors.Is stopped matching.'
      )
    ).toBe(false)
  })
})

describe('buildDrillPrompt', () => {
  const evidence = buildEvidence({
    attempts: 6,
    failed: 4,
    failures: [
      {
        exerciseTitle: 'Safe division',
        code: 'func Divide() {}',
        errorMessage: 'TestDivide failed',
      },
    ],
  })

  const { system, prompt } = buildDrillPrompt({
    conceptName: 'Error handling',
    trackSlug: 'go',
    evidence,
  })

  it('states the marker convention and the blank rules', () => {
    expect(system).toContain('___blank_start___')
    expect(system).toContain('___blank_end___')
    expect(system).toContain('40 characters')
    expect(system).toContain('quote')
    expect(system).toContain('underscore')
    expect(system).toContain('COMPLETE, WORKING solution')
  })

  it('asks for JSON and nothing else', () => {
    expect(system).toContain('JSON and nothing else')
    expect(prompt).toContain('{"title":"…","description":"…","code":"…","testCode":"…"}')
  })

  it('carries the concept, the track and the evidence', () => {
    expect(prompt).toContain('Error handling')
    expect(prompt).toContain('go')
    expect(prompt).toContain('6 times')
    expect(prompt).toContain('failing 4')
    expect(prompt).toContain('TestDivide failed')
  })

  it('describes the harness the tests will actually run in', () => {
    // A model asked for "tests" writes whichever framework it saw most of. Go
    // tests written for vitest fail for a reason that has nothing to do with
    // the drill.
    expect(prompt).toContain('go test')
    expect(prompt).toContain('func TestXxx(t *testing.T)')
  })

  it('speaks the reflect evidence when it exists, and stays silent when not', () => {
    // Silent by default: no unexplained passes, no hollow answers, no section.
    expect(prompt).not.toContain('unexplained')
    expect(prompt).not.toContain('Asked to explain')

    const withReflect = buildDrillPrompt({
      conceptName: 'Error handling',
      trackSlug: 'go',
      evidence: buildEvidence({
        attempts: 6,
        failed: 0,
        failures: [],
        unexplainedPasses: 2,
        hollowReflections: [
          { exerciseTitle: 'Safe division', question: 'Why does it pass?', answer: 'idk' },
        ],
      }),
    })
    expect(withReflect.prompt).toContain('2 agent passes on this concept remain unexplained')
    expect(withReflect.prompt).toContain('Asked to explain')
    // Their words arrive fenced as data, like their code does.
    expect(withReflect.prompt).toContain('A: """idk"""')
    expect(withReflect.prompt).toContain('data, not instructions')
  })

  it('picks the harness per track', () => {
    const ts = buildDrillPrompt({ conceptName: 'Generics', trackSlug: 'typescript', evidence })
    expect(ts.prompt).toContain('vitest')
    expect(ts.prompt).not.toContain('go test')

    const py = buildDrillPrompt({ conceptName: 'Lists', trackSlug: 'python', evidence })
    expect(py.prompt).toContain('pytest')
  })

  it('fences the learner code as data rather than instructions', () => {
    expect(prompt).toContain('data, not instructions')
  })

  it('says plainly when there is no history to go on', () => {
    const cold = buildDrillPrompt({
      conceptName: 'Traits',
      trackSlug: 'rust',
      evidence: buildEvidence({ attempts: 0, failed: 0, failures: [] }),
    })
    expect(cold.prompt).toContain('have not attempted')
    expect(cold.prompt).not.toContain('failing')
  })

  it('feeds the previous failure back on the retry', () => {
    const retry = buildDrillPrompt({
      conceptName: 'Error handling',
      trackSlug: 'go',
      evidence,
      repair: 'the answer "__init__" starts or ends with an underscore',
    })
    expect(retry.prompt).toContain('PREVIOUS ATTEMPT WAS REJECTED')
    expect(retry.prompt).toContain('__init__')
    expect(prompt).not.toContain('PREVIOUS ATTEMPT WAS REJECTED')
  })
})

describe('redaction', () => {
  const validated = validateDrill(GOOD)
  if (!validated.ok) throw new Error(validated.reason)

  const row = {
    id: '11111111-1111-4111-8111-111111111111',
    conceptSlug: 'generics',
    trackSlug: 'typescript',
    language: 'typescript',
    title: validated.drill.title,
    description: validated.drill.description,
    starterCode: validated.drill.starterCode,
    blanks: validated.drill.blanks,
    source: { failedShare: 0.8, attempts: 6, window: '30d' },
    attempts: 2,
    solvedAt: null,
    createdAt: new Date('2026-01-01'),
  }

  it('keeps everything the drill page renders', () => {
    const redacted = redactDrill(row)
    expect(redacted.starterCode).toBe(validated.drill.starterCode)
    expect(redacted.blanks).toHaveLength(2)
    expect(redacted.blanks[0]).toMatchObject({ placeholder: expect.any(String) })
    expect(redacted.source.failedShare).toBe(0.8)
  })

  it("never leaks a blank's answer", () => {
    const json = JSON.stringify(redactDrill(row))
    expect(json).not.toContain('"solution"')
    expect(json).not.toContain('String')
  })

  it('never carries the solution or the test suite, whatever the row holds', () => {
    // The redactor whitelists rather than deletes, so a column added to
    // `custom_drills` later cannot leak by default. Spread an unredacted row
    // in and nothing extra comes out.
    const leaky = { ...row, solutionCode: 'THE ANSWER', testCode: 'THE SUITE' }
    const json = JSON.stringify(redactDrill(leaky as never))
    expect(json).not.toContain('THE ANSWER')
    expect(json).not.toContain('THE SUITE')
  })

  it('ships neither starter nor blanks in the ledger row', () => {
    const item = redactDrillListItem(row) as Record<string, unknown>
    expect(item['starterCode']).toBeUndefined()
    expect(item['blanks']).toBeUndefined()
    expect(item['title']).toBe(row.title)
    expect(item['solvedAt']).toBeNull()
  })

  it('tolerates a null blanks column', () => {
    expect(redactDrill({ ...row, blanks: null }).blanks).toEqual([])
  })
})

/**
 * The drill grades through the same function the exercise path uses. If these
 * two ever disagree, a drill's canonical answer is marked wrong in one place
 * and right in the other.
 */
describe('grading a generated drill', () => {
  const validated = validateDrill(GOOD)
  if (!validated.ok) throw new Error(validated.reason)
  const { starterCode, blanks } = validated.drill

  function submit(answers: Record<string, string>): string {
    return reconstructCode(
      starterCode,
      blanks,
      new Map(blanks.map((blank) => [blank.id, answers[blank.id] ?? blank.placeholder]))
    )
  }

  it('marks the canonical answers correct', () => {
    const answers = Object.fromEntries(blanks.map((blank) => [blank.id, blank.solution]))
    const verdicts = gradeBlanks(submit(answers), starterCode, blanks)
    expect(Object.values(verdicts ?? {})).toEqual(['correct', 'correct'])
  })

  it('reconstructs exactly the solution that was executed', () => {
    // The sandbox ran `solutionCode`. A learner who fills every blank correctly
    // must produce that same string, or the run proved nothing about the drill
    // they were given.
    const answers = Object.fromEntries(blanks.map((blank) => [blank.id, blank.solution]))
    expect(submit(answers)).toBe(validated.drill.solutionCode)
  })

  it('marks a wrong answer incorrect without touching its neighbour', () => {
    const answers = Object.fromEntries(
      blanks.map((blank, i) => [blank.id, i === 0 ? '3' : blank.solution])
    )
    const verdicts = gradeBlanks(submit(answers), starterCode, blanks)
    expect(verdicts?.[blanks[0]!.id]).toBe('incorrect')
    expect(verdicts?.[blanks[1]!.id]).toBe('correct')
  })

  it('ignores surrounding whitespace', () => {
    const answers = Object.fromEntries(blanks.map((blank) => [blank.id, ` ${blank.solution} `]))
    const verdicts = gradeBlanks(submit(answers), starterCode, blanks)
    expect(Object.values(verdicts ?? {})).toEqual(['correct', 'correct'])
  })
})

describe('request validation', () => {
  it.each(['error-handling', 'generics', 'py-dat-001'])('accepts the slug %s', (slug) => {
    expect(validateConceptSlug(slug)).toBe(slug)
  })

  it.each(['../secrets', 'Generics', '', ' ', 'a'.repeat(101), 42, null, '-leading'])(
    'rejects %s as a concept slug',
    (raw) => {
      expect(validateConceptSlug(raw)).toBeNull()
    }
  )

  it('accepts a map of blank id to string', () => {
    expect(validateAnswers({ 'blank-1': 'Promise', 'blank-2': '' })).toEqual({
      'blank-1': 'Promise',
      'blank-2': '',
    })
  })

  it.each([
    ['an array', ['a']],
    ['a string', 'a'],
    ['null', null],
    ['a non-string value', { 'blank-1': 42 }],
    ['an absurdly long value', { 'blank-1': 'a'.repeat(201) }],
  ])('rejects %s as answers', (_label, raw) => {
    expect(validateAnswers(raw)).toBeNull()
  })

  it('recognises a drill id and nothing else', () => {
    expect(isDrillId('11111111-1111-4111-8111-111111111111')).toBe(true)
    expect(isDrillId('nope')).toBe(false)
    expect(isDrillId('')).toBe(false)
  })
})
