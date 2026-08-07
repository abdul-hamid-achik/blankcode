---
slug: ts-tool-001
title: 'Build the tool: find the tests that assert nothing'
description: A test with no assertion passes as long as the code compiles. Reviewing for it by hand does not scale. Write the check that finds them across a whole corpus.
difficulty: intermediate
type: challenge
hints:
  - Work at the level of each test body, not the whole file — one bad test in a good file still has to be reported.
  - A test that only calls a function is not asserting anything about what it returned.
  - Report a location, not just a boolean. A finding nobody can navigate to is a finding nobody fixes.
tags:
  - tooling
  - linting
  - testing
---

This exercise is real. This platform shipped 91 exercises, and two of them
contained a test that asserted nothing — it called the function, ignored the
result, and passed as long as the code compiled. Such a test cannot tell a
correct implementation from a wrong one, so an exercise resting on it grades
everybody as correct.

Nobody found those two by reading. A rule found them in 40 milliseconds, and
then kept finding them every time somebody wrote a new exercise.

That is the move: when a check is worth doing more than twice, stop doing it and
build the thing that does it. Write `findAssertionlessTests`.

```typescript
export interface Finding {
  /** The file the test is in, as given. */
  file: string
  /** 1-based line of the test's opening line. */
  line: number
  /** The test's name, as written. */
  name: string
}

export interface SourceFile {
  path: string
  contents: string
}

/**
 * Reports every test that contains no assertion.
 *
 * A test counts as asserting if its body mentions `expect(`, `assert(` or
 * `.should`. Tests are `it('name', ...)` or `test('name', ...)`; a `describe`
 * block is not a test and does not need an assertion of its own.
 */
export function findAssertionlessTests(files: SourceFile[]): Finding[] {
  // Your implementation here
  return []
}
```

## Tests

```typescript
import { describe, expect, it } from 'vitest'
import { findAssertionlessTests } from './solution'

const file = (contents: string, path = 'a.test.ts') => ({ path, contents })

describe('findAssertionlessTests', () => {
  it('reports a test with no assertion', () => {
    const findings = findAssertionlessTests([
      file(`it('does a thing', () => {\n  doAThing()\n})\n`),
    ])

    expect(findings).toHaveLength(1)
    expect(findings[0]?.name).toBe('does a thing')
  })

  it('does not report a test that asserts', () => {
    expect(
      findAssertionlessTests([file(`it('works', () => {\n  expect(1).toBe(1)\n})\n`)])
    ).toEqual([])
  })

  it('accepts assert() and .should as assertions too', () => {
    expect(
      findAssertionlessTests([
        file(`it('a', () => {\n  assert(true)\n})\nit('b', () => {\n  result.should.equal(1)\n})\n`),
      ])
    ).toEqual([])
  })

  it('handles test() as well as it()', () => {
    const findings = findAssertionlessTests([file(`test('nothing', () => {\n  run()\n})\n`)])
    expect(findings).toHaveLength(1)
    expect(findings[0]?.name).toBe('nothing')
  })

  it('reports the line the test starts on', () => {
    const findings = findAssertionlessTests([
      file(`// a comment\n\nit('empty', () => {\n  run()\n})\n`),
    ])
    expect(findings[0]?.line).toBe(3)
  })

  it('reports the file it came from', () => {
    const findings = findAssertionlessTests([
      file(`it('empty', () => {\n  run()\n})\n`, 'exercises/foo.test.ts'),
    ])
    expect(findings[0]?.file).toBe('exercises/foo.test.ts')
  })

  it('finds the bad test in a file that also has good ones', () => {
    // The whole point: one rotten test in an otherwise healthy file is exactly
    // what a human reviewer skims past.
    const findings = findAssertionlessTests([
      file(
        `it('good', () => {\n  expect(1).toBe(1)\n})\n\n` +
          `it('bad', () => {\n  run()\n})\n\n` +
          `it('also good', () => {\n  expect(2).toBe(2)\n})\n`
      ),
    ])

    expect(findings).toHaveLength(1)
    expect(findings[0]?.name).toBe('bad')
  })

  it('does not treat a describe block as a test', () => {
    expect(
      findAssertionlessTests([
        file(`describe('a group', () => {\n  it('works', () => {\n    expect(1).toBe(1)\n  })\n})\n`),
      ])
    ).toEqual([])
  })

  it('scans every file it is given', () => {
    const findings = findAssertionlessTests([
      file(`it('one', () => {\n  run()\n})\n`, 'one.test.ts'),
      file(`it('two', () => {\n  expect(1).toBe(1)\n})\n`, 'two.test.ts'),
      file(`it('three', () => {\n  run()\n})\n`, 'three.test.ts'),
    ])

    expect(findings.map((f) => f.file)).toEqual(['one.test.ts', 'three.test.ts'])
  })

  it('returns nothing for an empty corpus', () => {
    expect(findAssertionlessTests([])).toEqual([])
  })

  it('handles a file with no tests at all', () => {
    expect(findAssertionlessTests([file(`export const x = 1\n`)])).toEqual([])
  })

  it('handles double-quoted and backtick names', () => {
    const findings = findAssertionlessTests([
      file(`it("double", () => {\n  run()\n})\nit(\`tick\`, () => {\n  run()\n})\n`),
    ])
    expect(findings.map((f) => f.name)).toEqual(['double', 'tick'])
  })
})
```

## Solution

```typescript
export interface Finding {
  file: string
  line: number
  name: string
}

export interface SourceFile {
  path: string
  contents: string
}

const ASSERTIONS = ['expect(', 'assert(', '.should']

/**
 * Matches the opening line of a test and captures its name.
 *
 * `describe` is deliberately absent: a group is not a test, and requiring an
 * assertion directly inside one would flag every well-organised file.
 */
const TEST_OPENING = /^\s*(?:it|test)\s*\(\s*(['"`])(.*?)\1/

export function findAssertionlessTests(files: SourceFile[]): Finding[] {
  const findings: Finding[] = []

  for (const { path, contents } of files) {
    const lines = contents.split('\n')

    for (let index = 0; index < lines.length; index++) {
      const match = TEST_OPENING.exec(lines[index] ?? '')
      if (!match) continue

      /*
       * Brace depth rather than a regex over the whole body: a test can contain
       * nested functions, objects and further blocks, and anything that tries to
       * match the closing brace textually gets the wrong one as soon as it does.
       */
      let depth = 0
      let started = false
      let body = ''
      let end = index

      for (let scan = index; scan < lines.length; scan++) {
        const line = lines[scan] ?? ''
        body += `${line}\n`

        for (const char of line) {
          if (char === '{') {
            depth++
            started = true
          } else if (char === '}') {
            depth--
          }
        }

        end = scan
        if (started && depth <= 0) break
      }

      if (!ASSERTIONS.some((token) => body.includes(token))) {
        findings.push({ file: path, line: index + 1, name: match[2] ?? '' })
      }

      // Resume after this test so its own body cannot produce a second finding.
      index = end
    }
  }

  return findings
}
```
