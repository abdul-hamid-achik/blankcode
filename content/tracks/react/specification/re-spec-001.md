---
slug: re-spec-001
title: 'Pin it down: the cases that make a classnames helper unambiguous'
description: Five implementations of cn(). One is right and four skip a sentence each — and every one of them handles cn('btn', 'active') perfectly. Write the cases that tell them apart.
difficulty: intermediate
type: challenge
hints:
  - Each wrong implementation ignores exactly one sentence. Read the description clause by clause and design one argument list per clause.
  - Two plain strings satisfy everything. The disagreements need a falsy value, an object, a nested array, or all three.
  - Your expected values must be right too — the correct implementation has to pass every case you write.
tags:
  - specification
  - testing
  - utilities
---

Every React codebase has a `cn()`. Ask for one and you will get something
that handles `cn('btn', 'active')`. It will also do *something* with
`false && 'active'`, with `{ hidden: isHidden }`, and with a nested array
from a variadic helper — and each of those somethings is a decision
somebody made without telling you.

Here is the description, stated properly:

> `cn(...args)` builds a className string. Strings are included as they
> are. Falsy arguments — `false`, `null`, `undefined`, the empty string —
> are skipped entirely. An object contributes each of its keys whose value
> is truthy. Arrays are flattened, and the flattening is recursive. The
> result joins what remains with single spaces, with no leading or trailing
> whitespace.

Below are five implementations. One satisfies that description. Four
satisfy a reading of it that skips one sentence — and all five agree on
`cn('btn', 'active')`.

**Your job is not to write `cn`.** It is to write the cases that accept
the correct implementation and reject each of the other four.

```typescript
export type CnArg =
  | string
  | false
  | null
  | undefined
  | Record<string, boolean>
  | CnArg[]

export interface Case {
  args: CnArg[]
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
import { CASES, type CnArg } from './solution'

type Cn = (...args: CnArg[]) => string

/** Satisfies every sentence of the description. */
const correct: Cn = (...args) => {
  const out: string[] = []
  const visit = (arg: CnArg): void => {
    if (!arg) return
    if (typeof arg === 'string') {
      out.push(arg)
      return
    }
    if (Array.isArray(arg)) {
      for (const inner of arg) visit(inner)
      return
    }
    for (const [key, on] of Object.entries(arg)) {
      if (on) out.push(key)
    }
  }
  for (const arg of args) visit(arg)
  return out.join(' ')
}

/** Skips "falsy arguments are skipped entirely". */
const keepsFalsy: Cn = (...args) => {
  const out: string[] = []
  const visit = (arg: CnArg): void => {
    if (typeof arg === 'string') {
      out.push(arg)
      return
    }
    if (Array.isArray(arg)) {
      for (const inner of arg) visit(inner)
      return
    }
    if (arg && typeof arg === 'object') {
      for (const [key, on] of Object.entries(arg)) {
        if (on) out.push(key)
      }
      return
    }
    out.push(String(arg))
  }
  for (const arg of args) visit(arg)
  return out.join(' ')
}

/** Skips "whose value is truthy" — an object contributes every key. */
const objectKeysAlways: Cn = (...args) => {
  const out: string[] = []
  const visit = (arg: CnArg): void => {
    if (!arg) return
    if (typeof arg === 'string') {
      out.push(arg)
      return
    }
    if (Array.isArray(arg)) {
      for (const inner of arg) visit(inner)
      return
    }
    out.push(...Object.keys(arg))
  }
  for (const arg of args) visit(arg)
  return out.join(' ')
}

/** Skips "the flattening is recursive" — flattens exactly one level. */
const flattensOneLevel: Cn = (...args) => {
  const out: string[] = []
  const leaf = (arg: CnArg): void => {
    if (!arg) return
    if (typeof arg === 'string') {
      out.push(arg)
      return
    }
    if (Array.isArray(arg)) return
    for (const [key, on] of Object.entries(arg)) {
      if (on) out.push(key)
    }
  }
  for (const arg of args) {
    if (Array.isArray(arg)) {
      for (const inner of arg) leaf(inner)
    } else {
      leaf(arg)
    }
  }
  return out.join(' ')
}

/** Skips the joining sentence — joins raw entries, empties included. */
const sloppyJoin: Cn = (...args) => {
  const out: string[] = []
  const visit = (arg: CnArg): void => {
    if (arg === false || arg === null || arg === undefined) {
      out.push('')
      return
    }
    if (typeof arg === 'string') {
      out.push(arg)
      return
    }
    if (Array.isArray(arg)) {
      for (const inner of arg) visit(inner)
      return
    }
    for (const [key, on] of Object.entries(arg)) {
      if (on) out.push(key)
    }
  }
  for (const arg of args) visit(arg)
  return out.join(' ')
}

const WRONG: Array<[string, Cn]> = [
  ['one that stringifies falsy arguments', keepsFalsy],
  ['one that takes every object key', objectKeysAlways],
  ['one that flattens a single level', flattensOneLevel],
  ['one that joins empties into double spaces', sloppyJoin],
]

const survives = (cn: Cn) =>
  CASES.every((testCase) => cn(...testCase.args) === testCase.expected)

describe('the cases', () => {
  it('exist', () => {
    expect(CASES.length).toBeGreaterThan(0)
  })

  it('are all correct', () => {
    for (const testCase of CASES) {
      expect(correct(...testCase.args), `for ${JSON.stringify(testCase.args)}`).toBe(
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

  it('have no duplicate argument lists', () => {
    const keys = CASES.map((testCase) => JSON.stringify(testCase.args))
    expect(new Set(keys).size).toBe(keys.length)
  })
})
```

## Solution

```typescript
export type CnArg =
  | string
  | false
  | null
  | undefined
  | Record<string, boolean>
  | CnArg[]

export interface Case {
  args: CnArg[]
  expected: string
}

/*
 * Four wrong implementations, four sentences, one case aimed at each. The
 * two-string baseline is deliberately the least interesting case here:
 * agreement on the easy input is what hides the disagreements until they
 * reach a DOM.
 */
export const CASES: Case[] = [
  // The baseline all five get right.
  { args: ['btn', 'active'], expected: 'btn active' },

  // Falsy is SKIPPED, not stringified: the `cond && 'class'` idiom makes
  // false the single most common argument cn receives. The stringifier
  // renders "false btn"; the sloppy joiner renders " btn".
  { args: [false, 'btn', null], expected: 'btn' },

  // Only truthy object values contribute. The keys-always reading turns
  // every conditional class permanently on — which reads fine in a demo
  // where everything is true.
  { args: [{ hidden: false, visible: true }], expected: 'visible' },

  // Recursion: a nested array from a variadic helper. One level of
  // flattening silently drops "deep".
  { args: [['btn', ['deep']], 'last'], expected: 'btn deep last' },
]
```
