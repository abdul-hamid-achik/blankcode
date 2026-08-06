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
    // The tests are what you are measured against — seeing them is the exercise.
    expect(redacted.testCode).toBe(EXERCISE.testCode)
    expect(redacted.blanks[0]).toMatchObject({ id: 'b1', from: 10, to: 13, placeholder: '___' })
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
