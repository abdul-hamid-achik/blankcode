---
slug: vue-tool-001
title: 'Build the tool: find the watcher that watched a value'
description: A search composable here shipped a watch(state.query) that never fired once. Vue only warns at runtime, on the path nobody exercises. Write the rule that finds it in source.
difficulty: intermediate
type: challenge
hints:
  - The signal is watch( followed immediately by a member expression — a dot between identifiers before the first comma.
  - A getter (an arrow function) or a bare identifier as the first argument is fine. The dot without the arrow is the bug.
  - watchEffect takes a function by construction and is never a finding.
tags:
  - tooling
  - reactivity
  - static-analysis
---

This exercise is real. This platform's Vue track ships a search composable
whose original sin was one line: `watch(state.query, …)`. The expression
evaluates immediately — to a plain string — and a string carries no
subscription, so the watcher never fired. Not once. Vue does log a warning,
but a warning at runtime on a code path nobody exercises is a message to no
one.

The shape is fully visible in source: `watch(` followed by a member
expression. It does not need a runtime to be caught — it needs a rule.

Write `findValueWatchers`. It scans files and reports every `watch(` call
whose first argument is a member expression — an identifier, a dot, and
more identifier — rather than a function or a bare identifier. A getter
(`watch(() => state.query, …)`) is the fix and never a finding; a bare ref
(`watch(query, …)`) is legitimate; `watchEffect(…)` takes a function by
construction and is never a finding.

```typescript
export interface ValueWatcher {
  /** The file the watcher is in, as given. */
  file: string
  /** 1-based line of the watch call. */
  line: number
  /** The member expression that was handed to watch, e.g. "state.query". */
  source: string
}

export interface SourceFile {
  path: string
  contents: string
}

/**
 * Reports every watch() whose first argument is a member expression —
 * a value read once, where a source read every time was needed.
 */
export function findValueWatchers(files: SourceFile[]): ValueWatcher[] {
  // Your implementation here
  return []
}
```

## Tests

```typescript
import { describe, expect, it } from 'vitest'
import { findValueWatchers, type SourceFile } from './solution'

function source(path: string, ...lines: string[]): SourceFile {
  return { path, contents: lines.join('\n') }
}

describe('findValueWatchers', () => {
  it('reports watch on a member expression, with the expression', () => {
    const file = source('search.ts', 'watch(state.query, (query) => run(query))')
    expect(findValueWatchers([file])).toEqual([
      { file: 'search.ts', line: 1, source: 'state.query' },
    ])
  })

  it('accepts a getter', () => {
    const file = source('ok.ts', 'watch(() => state.query, (query) => run(query))')
    expect(findValueWatchers([file])).toEqual([])
  })

  it('accepts a bare ref', () => {
    const file = source('ref.ts', 'watch(query, (value) => run(value))')
    expect(findValueWatchers([file])).toEqual([])
  })

  it('accepts watchEffect', () => {
    const file = source('effect.ts', 'watchEffect(() => run(state.query))')
    expect(findValueWatchers([file])).toEqual([])
  })

  it('reports deep member chains', () => {
    const file = source('deep.ts', 'watch(store.filters.category, reload)')
    expect(findValueWatchers([file])).toEqual([
      { file: 'deep.ts', line: 1, source: 'store.filters.category' },
    ])
  })

  it('reports props destructure-adjacent watching', () => {
    // The other famous spelling of the same bug.
    const file = source('props.ts', 'watch(props.modelValue, sync)')
    expect(findValueWatchers([file])).toEqual([
      { file: 'props.ts', line: 1, source: 'props.modelValue' },
    ])
  })

  it('carries line numbers and reports in order', () => {
    const file = source(
      'mixed.ts',
      'watch(() => state.a, onA)',
      'watch(state.b, onB)',
      'watch(state.c, onC)'
    )
    expect(findValueWatchers([file])).toEqual([
      { file: 'mixed.ts', line: 2, source: 'state.b' },
      { file: 'mixed.ts', line: 3, source: 'state.c' },
    ])
  })

  it('handles an empty file list', () => {
    expect(findValueWatchers([])).toEqual([])
  })
})
```

## Solution

```typescript
export interface ValueWatcher {
  file: string
  line: number
  source: string
}

export interface SourceFile {
  path: string
  contents: string
}

/**
 * Reports every watch() whose first argument is a member expression —
 * a value read once, where a source read every time was needed.
 */
export function findValueWatchers(files: SourceFile[]): ValueWatcher[] {
  const findings: ValueWatcher[] = []
  /*
   * `watch(` then a member chain, then a comma. The word boundary keeps
   * watchEffect out (its name does not end at `watch`), and requiring the
   * dot keeps bare refs out — both are legitimate sources. The getter form
   * starts with `(` or `)` `=>`, which this pattern cannot match, so the
   * fix never re-triggers the rule that demanded it.
   */
  const valueWatch = /\bwatch\(\s*([A-Za-z_$][\w$]*(?:\.[\w$]+)+)\s*,/g

  for (const file of files) {
    const lines = file.contents.split('\n')
    for (let i = 0; i < lines.length; i++) {
      for (const match of lines[i]!.matchAll(valueWatch)) {
        findings.push({ file: file.path, line: i + 1, source: match[1]! })
      }
    }
  }

  return findings
}
```
