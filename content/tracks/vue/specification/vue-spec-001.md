---
slug: vue-spec-001
title: 'Pin it down: the cases that make a relative timestamp unambiguous'
description: Five implementations of relativeLabel. One is right and four skip a sentence each — and all five agree that ten minutes ago was "10 minutes ago". Write the cases that tell them apart.
difficulty: intermediate
type: challenge
hints:
  - Each wrong implementation ignores exactly one sentence. The boundaries — 45 seconds, 90 seconds, 45 minutes — are where readings diverge.
  - '"1 minutes ago" is grammar, and grammar is a clause: a case with a value of exactly one is aimed at the implementation that pluralizes blindly.'
  - Your expected values must be right too — the correct implementation has to pass every case you write.
tags:
  - specification
  - testing
  - formatting
---

This site's marginalia — "last used 3m ago", "recorded your reflection
2h ago" — runs on a function like this one. Ask for "format seconds as a
relative label" and you will get something that turns ten minutes into
`10 minutes ago`. It will also do *something* with 30 seconds, with 90
seconds, and with exactly one minute — and each of those somethings is a
decision somebody made without telling you.

Here is the description, stated properly:

> `relativeLabel(deltaSeconds)` renders how long ago something happened.
> Under 45 seconds it is `"just now"`. From there to 45 minutes it renders
> whole minutes, **rounded to nearest**, as `"N minutes ago"` — singular
> `"1 minute ago"` when N is one. Everything else renders whole hours,
> rounded to nearest, with the same singular rule.

Below are five implementations. One satisfies that description. Four
satisfy a reading of it that skips one sentence — and all five agree on
ten minutes.

**Your job is not to write `relativeLabel`.** It is to write the cases
that accept the correct implementation and reject each of the other four.

```typescript
export interface Case {
  deltaSeconds: number
  expected: string
}

/**
 * The cases that pin the description down.
 *
 * To pass, this list must accept the correct implementation and reject
 * each of the four wrong ones. A case whose `expected` is not what the
 * description requires will fail against the correct implementation, so
 * getting the values right is part of the exercise.
 */
export const CASES: Case[] = [
  // Your cases here
]
```

## Tests

```typescript
import { describe, expect, it } from 'vitest'
import { CASES } from './solution'

type Label = (deltaSeconds: number) => string

const unit = (value: number, name: string) =>
  `${value} ${name}${value === 1 ? '' : 's'} ago`

/** Satisfies every sentence of the description. */
const correct: Label = (delta) => {
  if (delta < 45) return 'just now'
  if (delta < 45 * 60) return unit(Math.round(delta / 60), 'minute')
  return unit(Math.round(delta / 3600), 'hour')
}

/** Skips "rounded to nearest" — floors instead. */
const floors: Label = (delta) => {
  if (delta < 45) return 'just now'
  if (delta < 45 * 60) return unit(Math.max(1, Math.floor(delta / 60)), 'minute')
  return unit(Math.max(1, Math.floor(delta / 3600)), 'hour')
}

/** Skips the singular sentence — pluralizes everything. */
const pluralAlways: Label = (delta) => {
  if (delta < 45) return 'just now'
  if (delta < 45 * 60) return `${Math.round(delta / 60)} minutes ago`
  return `${Math.round(delta / 3600)} hours ago`
}

/** Skips "under 45 seconds it is just now". */
const noJustNow: Label = (delta) => {
  if (delta < 45 * 60) return unit(Math.round(delta / 60), 'minute')
  return unit(Math.round(delta / 3600), 'hour')
}

/** Skips "everything else renders whole hours" — minutes forever. */
const minutesForever: Label = (delta) => {
  if (delta < 45) return 'just now'
  return unit(Math.round(delta / 60), 'minute')
}

const WRONG: Array<[string, Label]> = [
  ['one that floors instead of rounding', floors],
  ['one that pluralizes one', pluralAlways],
  ['one that never says just now', noJustNow],
  ['one that renders minutes forever', minutesForever],
]

const survives = (label: Label) =>
  CASES.every((testCase) => label(testCase.deltaSeconds) === testCase.expected)

describe('the cases', () => {
  it('exist', () => {
    expect(CASES.length).toBeGreaterThan(0)
  })

  it('are all correct', () => {
    for (const testCase of CASES) {
      expect(correct(testCase.deltaSeconds), `for ${testCase.deltaSeconds}s`).toBe(
        testCase.expected
      )
    }
  })

  it('accept the correct implementation', () => {
    expect(survives(correct)).toBe(true)
  })

  for (const [name, wrong] of WRONG) {
    it(`reject ${name}`, () => {
      expect(survives(wrong)).toBe(false)
    })
  }

  it('do not pass by sheer volume', () => {
    expect(CASES.length).toBeLessThanOrEqual(12)
  })

  it('have no duplicate inputs', () => {
    const inputs = CASES.map((testCase) => testCase.deltaSeconds)
    expect(new Set(inputs).size).toBe(inputs.length)
  })
})
```

## Solution

```typescript
export interface Case {
  deltaSeconds: number
  expected: string
}

/*
 * Four wrong implementations, four sentences, one case aimed at each. Ten
 * minutes is deliberately the least interesting value here: everyone
 * agrees on it, and agreement on the easy value is what hides the
 * disagreements until they reach the page margin.
 */
export const CASES: Case[] = [
  // The baseline all five get right.
  { deltaSeconds: 600, expected: '10 minutes ago' },

  // Under 45 seconds is "just now" — the sentence the eager formatter
  // skips, answering "1 minute ago" for a 30-second-old event.
  { deltaSeconds: 30, expected: 'just now' },

  // Rounding, not flooring: 150s is 2.5 minutes, and "rounded to nearest"
  // says 3. The floorer says 2. (Math.round rounds half up.)
  { deltaSeconds: 150, expected: '3 minutes ago' },

  // Exactly one minute: singular. "1 minutes ago" is the reading that
  // skipped the grammar clause.
  { deltaSeconds: 60, expected: '1 minute ago' },

  // Past 45 minutes the unit changes: two hours is "2 hours ago", and the
  // minutes-forever reading writes "120 minutes ago".
  { deltaSeconds: 7200, expected: '2 hours ago' },
]
```
