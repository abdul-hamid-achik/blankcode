---
slug: ts-turn-002
title: 'Three messages: a duration parser that refuses politely'
description: Get a model to write a duration parser in three messages. The hidden suite checks the two refusals people never ask for — and a model never volunteers.
difficulty: intermediate
type: turn
turnBudget: 3
hints:
  - The spec names exactly three units. A model will add more, helpfully, unless the first message closes that door.
  - Ask yourself what "5" means with no unit. The spec has an answer; a model left alone will pick a different one and not mention it.
  - Read what comes back before spending the second message. The defect will be in a case you never named.
tags:
  - ai
  - prompting
  - parsing
---

Write `parseDuration`, using a model, in **three messages**.

> `parseDuration(input)` parses a duration like `"2h"`, `"45m"`, `"90s"`, or a
> combination like `"1h30m"`, and returns the total in milliseconds. The units
> are `h`, `m`, and `s` — exactly these. Anything else in the string is an
> error: an unknown unit, a number with no unit, an empty string all throw.

That is the whole specification, and its edges are where the exercise lives.
"Exactly these" and "all throw" are the clauses a quick first message drops —
and a model fills the gap generously: it will accept `"3d"` because days seem
useful, and read a bare `"5"` as seconds because a guess feels kinder than an
exception. Both guesses are wrong here, and both are silent.

**The suite you are graded against is hidden until you submit.** You cannot
paste it to the model; if you could, the skill being practised would be
pasting.

You have three messages and you do not have to use them. Submitting with a
turn in hand is a better result, and the report says which happened.

```typescript
/**
 * Parses "2h", "45m", "90s", "1h30m" (units h/m/s only) into milliseconds.
 *
 * Write this with the model. When you are satisfied, submit — the hidden
 * suite runs against whatever is in here.
 */
export function parseDuration(input: string): number {
  throw new Error('not implemented')
}
```

## Tests

```typescript
import { describe, expect, it } from 'vitest'
import { parseDuration } from './solution'

describe('parseDuration', () => {
  it('parses whole hours', () => {
    expect(parseDuration('2h')).toBe(7_200_000)
  })

  it('parses minutes', () => {
    expect(parseDuration('45m')).toBe(2_700_000)
  })

  it('parses seconds', () => {
    expect(parseDuration('90s')).toBe(90_000)
  })

  it('parses combined units', () => {
    expect(parseDuration('1h30m')).toBe(5_400_000)
  })

  it('parses a combination that skips a unit', () => {
    expect(parseDuration('1h5s')).toBe(3_605_000)
  })

  it('parses a zero duration', () => {
    expect(parseDuration('0s')).toBe(0)
  })

  it('allows values past the natural carry', () => {
    // "90m" is ninety minutes, not an error and not 1h30m-only input.
    expect(parseDuration('90m')).toBe(5_400_000)
  })

  it('throws on an unknown unit', () => {
    // The generous reading: days seem useful, so an unsupervised model adds
    // them. The spec said "exactly these" — support is a decision, not a
    // favour.
    expect(() => parseDuration('3d')).toThrow()
  })

  it('throws on a number with no unit', () => {
    // The other silent guess: "5" read as seconds. A caller who meant five
    // minutes gets a timeout 60 times shorter and no error to notice it by.
    expect(() => parseDuration('5')).toThrow()
  })

  it('throws on an empty string', () => {
    expect(() => parseDuration('')).toThrow()
  })

  it('throws on trailing garbage', () => {
    expect(() => parseDuration('1h30x')).toThrow()
  })
})
```

## Solution

```typescript
/**
 * Parses "2h", "45m", "90s", "1h30m" (units h/m/s only) into milliseconds.
 */
export function parseDuration(input: string): number {
  /*
   * The two clauses that decide this exercise are refusals, and refusals are
   * what a model never volunteers:
   *
   * - units are h/m/s EXACTLY. "3d" throwing is a product decision — the
   *   generous parser that accepts days will happily accept "3w" next, and
   *   every caller now depends on behaviour nobody specified.
   * - a bare number throws. Guessing seconds (or milliseconds) for "5" turns
   *   a malformed input into a silently different duration.
   *
   * The whole-string match is what enforces both: nothing outside
   * digit+unit groups survives it.
   */
  if (!/^(\d+[hms])+$/.test(input)) {
    throw new Error(`not a duration: ${JSON.stringify(input)}`)
  }

  const MS_PER_UNIT: Record<string, number> = {
    h: 3_600_000,
    m: 60_000,
    s: 1_000,
  }

  let total = 0
  for (const [, value, unit] of input.matchAll(/(\d+)([hms])/g)) {
    total += Number(value) * MS_PER_UNIT[unit]!
  }
  return total
}
```
