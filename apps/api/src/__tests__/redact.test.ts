import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gradeBlanks } from '@blankcode/shared'
import { describe, expect, it } from 'vitest'
import { redactBlank, redactExercise, redactExercises } from '../modules/exercises/redact.js'

/**
 * The API used to serialise the whole exercise row, so every response carried
 * `solutionCode` and each blank's exact `solution`. Reading the answer to any
 * exercise took one look at the Network tab, which makes the whole product
 * pointless. These tests exist so that never silently comes back.
 */

const EXERCISE = {
  id: 'ex-1',
  slug: 'generics',
  title: 'Generics',
  starterCode: 'const a = ___;',
  solutionCode: 'const a = 42;',
  testCode: "test('x', () => {})",
  hints: ['think'],
  blanks: [{ id: 'b1', from: 10, to: 13, placeholder: '___', solution: '42' }],
  concept: { id: 'c1', name: 'Basics' },
}

describe('redactExercise', () => {
  it('removes the full solution', () => {
    expect(redactExercise(EXERCISE)).not.toHaveProperty('solutionCode')
  })

  it("removes each blank's answer", () => {
    const blanks = redactExercise(EXERCISE).blanks
    expect(blanks).toHaveLength(1)
    expect(blanks[0]).not.toHaveProperty('solution')
  })

  it('keeps everything the editor needs', () => {
    const redacted = redactExercise(EXERCISE)
    expect(redacted.starterCode).toBe(EXERCISE.starterCode)
    expect(redacted.hints).toEqual(['think'])
    expect(redacted.blanks[0]).toMatchObject({ id: 'b1', from: 10, to: 13, placeholder: '___' })
  })

  it('strips the test suite', () => {
    // This asserted the opposite once — "seeing them is the exercise" — while
    // nothing in the client rendered them and the review exercises promised
    // hidden tests with the suite sitting in the response JSON. For a human
    // that is a Network-tab curiosity; for an agent reading the API, the
    // hidden suite lands in its working context and the exercise is void.
    const redacted = redactExercise(EXERCISE) as Record<string, unknown>
    expect(redacted['testCode']).toBeUndefined()
  })

  it('preserves relations', () => {
    expect(redactExercise(EXERCISE).concept).toEqual({ id: 'c1', name: 'Basics' })
  })

  it('tolerates an exercise with no blanks', () => {
    const { blanks: _blanks, ...challenge } = EXERCISE
    expect(redactExercise(challenge).blanks).toEqual([])
  })

  it('tolerates a null blanks column', () => {
    expect(redactExercise({ ...EXERCISE, blanks: null }).blanks).toEqual([])
  })

  it('never leaks an answer anywhere in the serialised payload', () => {
    const json = JSON.stringify(redactExercise(EXERCISE))
    expect(json).not.toContain('const a = 42;')
    expect(json).not.toContain('"solution"')
  })

  it('redacts every item in a list', () => {
    const json = JSON.stringify(redactExercises([EXERCISE, EXERCISE]))
    expect(json).not.toContain('const a = 42;')
    expect(json).not.toContain('"solution"')
  })
})

describe('redactBlank', () => {
  it('keeps only the fields the widget renders', () => {
    expect(Object.keys(redactBlank(EXERCISE.blanks[0]!)).toSorted()).toEqual([
      'from',
      'id',
      'placeholder',
      'to',
    ])
  })
})

/**
 * Grading moved server-side when the answers stopped being sent to the client,
 * so it has to agree with what the editor produced.
 */
describe('gradeBlanks', () => {
  const starter = 'const a = ___; const b = ___;'
  const blanks = [
    { id: 'b1', from: 10, to: 13, placeholder: '___', solution: '1' },
    { id: 'b2', from: 25, to: 28, placeholder: '___', solution: '2' },
  ]

  it('marks matching answers correct', () => {
    expect(gradeBlanks('const a = 1; const b = 2;', starter, blanks)).toEqual({
      b1: 'correct',
      b2: 'correct',
    })
  })

  it('marks a wrong answer incorrect without affecting its neighbour', () => {
    expect(gradeBlanks('const a = 9; const b = 2;', starter, blanks)).toEqual({
      b1: 'incorrect',
      b2: 'correct',
    })
  })

  it('ignores surrounding whitespace', () => {
    expect(gradeBlanks('const a =  1 ; const b = 2;', starter, blanks)?.['b1']).toBe('correct')
  })

  it('reports nothing when the code no longer matches the starter', () => {
    // Marking every blank wrong next to a passing test run is a lie; the honest
    // answer is that per-blank feedback is not available for this submission.
    expect(gradeBlanks('something else entirely', starter, blanks)).toBeNull()
  })

  it('reports nothing for an exercise with no blanks', () => {
    expect(gradeBlanks('anything', starter, [])).toBeNull()
  })

  it('handles an answer containing the following fixed segment', () => {
    const s = 'f(___)'
    const b = [{ id: 'arg', from: 2, to: 5, placeholder: '___', solution: 'g(1)' }]
    expect(gradeBlanks('f(g(1))', s, b)).toEqual({ arg: 'correct' })
  })
})

/**
 * `GET /submissions` returned the joined exercise untouched, so a learner's own
 * submission list shipped `solutionCode` and every blank's answer for each
 * attempt — the same leak that was closed in the exercises service, through a
 * path that was missed.
 *
 * Nothing pointed at it because the service interface returned `any`. It
 * surfaced the moment those types were written down, which is the argument for
 * writing them down.
 */
describe('the submissions list does not leak answers', () => {
  const service = readFileSync(
    join(process.cwd(), 'src/modules/submissions/submissions.service.ts'),
    'utf-8'
  )

  it('redacts every read that joins the exercise', () => {
    // Each `with: { exercise: ... }` has to pass through withBlankFeedback,
    // which is where redactExercise is applied.
    const joins = service.split('with: { exercise').length - 1
    const redacted = service.split('withBlankFeedback(').length - 1
    expect(redacted).toBeGreaterThanOrEqual(joins)
  })

  it('findByUser maps its rows rather than returning them raw', () => {
    // Sliced from the implementation, not the interface — `findByUser:`
    // appears in both, and the first hit is the type declaration.
    const implementation = service.slice(service.indexOf('SubmissionsServiceLive'))
    const method = implementation.slice(implementation.indexOf('findByUser:'))
    expect(method.slice(0, 800)).toContain('withBlankFeedback(row)')
  })

  it('the service contract is not `any`', () => {
    // `any` is what hid this. A contract that promises nothing cannot be
    // checked, and the leak lived behind exactly that.
    const shape = service.slice(
      service.indexOf('interface SubmissionsServiceShape'),
      service.indexOf('export class SubmissionsService')
    )
    expect(shape).not.toContain('Effect.Effect<any')
    expect(shape).not.toContain('Effect.Effect<any[]')
  })
})

/**
 * The review queue spread the raw exercise row, so the surface a learner opens
 * every day handed back `solutionCode` and every blank's answer for each
 * exercise due. Third path with the same defect, after the exercises service
 * and the submissions list.
 *
 * The pattern is worth naming: each leak was a place that joined an exercise
 * and returned it without going through `redactExercise`. Any new one will look
 * the same.
 */
describe('the review queue does not leak answers', () => {
  const service = readFileSync(
    join(process.cwd(), 'src/modules/reviews/reviews.service.ts'),
    'utf-8'
  )

  it('redacts the exercise it joins', () => {
    expect(service).toContain('redactExercise(')
  })

  it('redacts before spreading, not after', () => {
    // `...exercise` on a raw row is the bug. The redaction has to happen while
    // binding `exercise`, or the spread puts the answers straight back.
    const spread = service.indexOf('...exercise,')
    const redaction = service.indexOf('redactExercise(')
    expect(redaction).toBeGreaterThan(-1)
    expect(redaction).toBeLessThan(spread)
  })
})

/**
 * Every service that joins an exercise has to redact it. This is the check that
 * would have caught all three leaks at once, which is the argument for having
 * it rather than three separate ones.
 */
describe('no service returns an unredacted exercise join', () => {
  const MODULES = join(process.cwd(), 'src/modules')

  it.each(['submissions/submissions.service.ts', 'reviews/reviews.service.ts'])(
    '%s redacts what it joins',
    (file) => {
      const source = readFileSync(join(MODULES, file), 'utf-8')
      const joins = source.split(/with: \{\s*exercise/).length - 1
      if (joins === 0) return

      // withBlankFeedback is where the submissions service applies it.
      const redactions =
        source.split('redactExercise(').length - 1 + (source.split('withBlankFeedback(').length - 1)
      expect(
        redactions,
        `${file} joins an exercise more often than it redacts one`
      ).toBeGreaterThan(0)
    }
  )
})
