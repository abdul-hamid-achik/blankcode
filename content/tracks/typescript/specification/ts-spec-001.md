---
slug: ts-spec-001
title: 'Pin it down: the cases that make a slug unambiguous'
description: Six implementations of slugify. One is right and five are subtly wrong, and every one of them satisfies a careless reading of the request. Write the cases that tell them apart.
difficulty: intermediate
type: challenge
hints:
  - Each wrong implementation ignores exactly one sentence of the description. Read the description one sentence at a time and ask what input would expose it.
  - A case that only uses a simple input like "Hello World" is satisfied by almost every implementation. The useful cases are the awkward ones.
  - Your expected values have to be right too — the correct implementation has to pass every case you write.
tags:
  - specification
  - testing
  - code-review
---

Ask for "a function that turns a title into a URL slug" and you will get
something back that works on `Hello World`. It will also do something with
`  C++: A Guide!  `, and what it does is a decision somebody made without
telling you.

This is the most common way work goes wrong: the request was coherent, the code
is coherent, and they are about slightly different problems. The gap only closes
when the behaviour at the awkward inputs is written down.

Here is the description, stated properly:

> `slugify(title)` returns a URL slug. The result is lowercase. Any run of
> whitespace becomes a single hyphen. Characters that are not letters, digits or
> hyphens are removed. Runs of hyphens collapse into one. Leading and trailing
> hyphens are removed. An input with nothing usable in it returns an empty
> string.

Below are six implementations. One of them satisfies that description. Five
satisfy a reading of it that skips one sentence — and all five look fine.

**Your job is not to write `slugify`.** It is to write the cases that accept the
correct implementation and reject each of the other five.

```typescript
export interface Case {
  input: string
  expected: string
}

/**
 * The cases that pin the description down.
 *
 * To pass, this list must accept the correct implementation and reject each of
 * the five wrong ones. A case whose `expected` is not what the description
 * requires will fail against the correct implementation, so getting the values
 * right is part of the exercise.
 */
export const CASES: Case[] = [
  // Your cases here
]
```

## Tests

```typescript
import { describe, expect, it } from 'vitest'
import { CASES } from './solution'

type Slugify = (title: string) => string

/** Satisfies every sentence of the description. */
const correct: Slugify = (title) =>
  title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

/** Skips "the result is lowercase". */
const keepsCase: Slugify = (title) =>
  title
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

/** Skips "any RUN of whitespace" — replaces one space at a time. */
const oneSpaceOnly: Slugify = (title) =>
  title
    .toLowerCase()
    .replace(/ /g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-|-$/g, '')

/** Skips "characters that are not letters, digits or hyphens are removed". */
const keepsPunctuation: Slugify = (title) =>
  title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

/** Skips "runs of hyphens collapse into one". */
const keepsDoubleHyphens: Slugify = (title) =>
  title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '')

/** Skips "leading and trailing hyphens are removed". */
const keepsEdges: Slugify = (title) =>
  title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')

const WRONG: Array<[string, Slugify]> = [
  ['one that never lowercases', keepsCase],
  ['one that only replaces single spaces', oneSpaceOnly],
  ['one that keeps punctuation', keepsPunctuation],
  ['one that leaves double hyphens', keepsDoubleHyphens],
  ['one that leaves hyphens on the edges', keepsEdges],
]

const survives = (slugify: Slugify) =>
  CASES.every((testCase) => slugify(testCase.input) === testCase.expected)

describe('the cases', () => {
  it('exist', () => {
    expect(CASES.length).toBeGreaterThan(0)
  })

  it('are all correct', () => {
    // Every expected value has to be what the description actually requires.
    // A case built around a guess would reject the right implementation.
    for (const testCase of CASES) {
      expect(correct(testCase.input), `for input ${JSON.stringify(testCase.input)}`).toBe(
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
    // Five wrong implementations need at most five inputs to expose. A list of
    // fifty near-identical cases is not a specification, it is noise — and the
    // habit it teaches is the expensive one.
    expect(CASES.length).toBeLessThanOrEqual(12)
  })

  it('have no duplicate inputs', () => {
    const inputs = CASES.map((testCase) => testCase.input)
    expect(new Set(inputs).size).toBe(inputs.length)
  })
})
```

## Solution

```typescript
export interface Case {
  input: string
  expected: string
}

/*
 * Five wrong implementations, five sentences of the description, and each case
 * below is aimed at exactly one of them. That is the whole method: read the
 * specification one clause at a time and ask what input would make a version
 * that ignored this clause visibly disagree.
 *
 * Note how ordinary "Hello World" is useless here — every one of the six gets
 * it right. Agreement on the easy input is what makes the disagreement on the
 * hard one invisible until production.
 */
export const CASES: Case[] = [
  // Lowercasing. Nothing else about this input is unusual, so a failure here
  // can only mean one thing — cases that isolate a single rule are the ones
  // whose failures are worth reading.
  { input: 'Hello World', expected: 'hello-world' },

  // A run of whitespace, not a single space. The implementation that replaces
  // one space at a time produces "getting--started" and is caught here. The tab
  // is deliberate: "whitespace" in the description is not a synonym for " ".
  { input: 'Getting  \tStarted', expected: 'getting-started' },

  // Punctuation that has to disappear rather than become a hyphen, and which
  // leaves two hyphens adjacent once it does. One input, two rules: removal and
  // collapsing.
  { input: 'C++ : a guide', expected: 'c-a-guide' },

  // Surrounding whitespace becomes leading and trailing hyphens before anything
  // trims them. This is the case people leave out, because they type inputs by
  // hand and never type the spaces.
  { input: '  spaced out  ', expected: 'spaced-out' },

  // Nothing usable at all. The description says empty string; an implementation
  // that has not thought about it returns "-" or throws. Every specification
  // needs the input that has none of the thing it is about.
  { input: '!!!', expected: '' },
]
```
