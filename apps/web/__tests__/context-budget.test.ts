import { describe, expect, it } from 'vitest'
import {
  type ContextExercise,
  costOf,
  grade,
  minimalCost,
  passed,
} from '~/server/utils/context-budget'

const exercise: ContextExercise = {
  sources: [
    { id: 'schema', label: 'Table definitions', tokens: 400 },
    { id: 'sample-rows', label: 'Twenty example rows', tokens: 900 },
    { id: 'docs', label: 'The whole ORM manual', tokens: 6000 },
    { id: 'logs', label: 'Yesterday of query logs', tokens: 3000 },
  ],
  required: ['schema'],
}

describe('costOf', () => {
  it('adds up what was chosen', () => {
    expect(costOf(exercise, { sourceIds: ['schema', 'sample-rows'] }).tokens).toBe(1300)
  })

  it('charges a repeated source once', () => {
    // Asking twice is a client bug, not a purchase.
    expect(costOf(exercise, { sourceIds: ['schema', 'schema'] }).tokens).toBe(400)
  })

  it('reports an unknown id instead of dropping it', () => {
    // Silently ignoring it turns a typo into a cheap correct answer.
    const cost = costOf(exercise, { sourceIds: ['schema', 'schemma'] })
    expect(cost.tokens).toBe(400)
    expect(cost.unknown).toEqual(['schemma'])
  })

  it('costs nothing when nothing is chosen', () => {
    expect(costOf(exercise, { sourceIds: [] })).toEqual({ tokens: 0, unknown: [] })
  })
})

describe('minimalCost', () => {
  it('is the price of exactly what is needed', () => {
    expect(minimalCost(exercise)).toBe(400)
  })

  it('adds up when more than one source is required', () => {
    expect(minimalCost({ ...exercise, required: ['schema', 'sample-rows'] })).toBe(1300)
  })
})

describe('grade', () => {
  it('is a pass when the answer is right and enough was handed over', () => {
    const result = grade(exercise, { sourceIds: ['schema'] }, true)
    expect(passed(result)).toBe(true)
    expect(result.tokensWasted).toBe(0)
  })

  it('reports waste without failing the attempt', () => {
    // Handing over the manual is the instinct being corrected. It is still a
    // pass — efficiency is measured, not required, because a threshold would
    // push people to under-select and hope.
    const result = grade(exercise, { sourceIds: ['schema', 'docs'] }, true)
    expect(passed(result)).toBe(true)
    expect(result.tokensSpent).toBe(6400)
    expect(result.tokensWasted).toBe(6000)
    expect(result.unnecessary).toEqual(['docs'])
  })

  it('separates a right answer from having supplied what was needed', () => {
    // Right answer, nothing handed over: they knew it, or they guessed. Calling
    // that a cheap win teaches the wrong thing about what the model worked from.
    const result = grade(exercise, { sourceIds: [] }, true)
    expect(result.correct).toBe(true)
    expect(result.sufficient).toBe(false)
    expect(passed(result)).toBe(false)
  })

  it('fails a wrong answer even when everything was handed over', () => {
    const result = grade(exercise, { sourceIds: ['schema', 'docs', 'logs'] }, false)
    expect(result.sufficient).toBe(true)
    expect(passed(result)).toBe(false)
  })

  it('never reports negative waste for an under-selection', () => {
    // Cheaper than minimal is not a saving; treating it as one would reward
    // withholding exactly what the exercise is about supplying.
    const result = grade(exercise, { sourceIds: [] }, false)
    expect(result.tokensWasted).toBe(0)
  })

  it('does not count an unknown id as an unnecessary source', () => {
    // It bought nothing, so it is a typo to report, not an extravagance.
    const result = grade(exercise, { sourceIds: ['schema', 'nope'] }, true)
    expect(result.unnecessary).toEqual([])
    expect(result.unknown).toEqual(['nope'])
  })

  it('handles a required source being missing among several', () => {
    const two = { ...exercise, required: ['schema', 'sample-rows'] }
    const result = grade(two, { sourceIds: ['schema'] }, true)
    expect(result.sufficient).toBe(false)
    expect(passed(result)).toBe(false)
  })

  it('counts each unnecessary source once when repeated', () => {
    const result = grade(exercise, { sourceIds: ['schema', 'docs', 'docs'] }, true)
    expect(result.unnecessary).toEqual(['docs'])
    expect(result.tokensSpent).toBe(6400)
  })
})
