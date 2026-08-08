---
slug: re-tool-001
title: 'Build the tool: check every usage against the props table'
description: The wrong props for an internal Button feel type-checked because they are famous, not because they are right. The props table exists. Write the rule that holds every usage to it.
difficulty: intermediate
type: challenge
hints:
  - The allowed set is given; the work is extracting what each usage actually passes. Attribute names sit left of an equals sign, or stand alone as boolean shorthand.
  - A spread like {...rest} is not an attribute name. Skip tokens that start with a brace.
  - Report the prop, not just the line — the fix is a rename, and the message should hand it over.
tags:
  - tooling
  - props
  - static-analysis
---

This exercise is real in shape: this platform's context exercises exist
because models write `variant="destructive" size="sm"` against design
systems whose props are `intent` and `compact` — the famous names, not the
real ones. A human reviewer misses it for the same reason the model
guessed it: it *looks* standard.

The props table already exists. The gap is that nothing holds usages to
it, so the wrong name is discovered by the TypeScript build at best and by
a rendering bug at worst. A rule closes the gap at the door.

Write `findUnknownProps`. Given a component name, its allowed prop names,
and source files, it reports every attribute passed to that component that
is not in the allowed set. Attributes appear as `name=...` or as bare
boolean shorthand (`busy`). Spreads (`{...rest}`) are not attributes and
are ignored. `children` never appears as an attribute and needs no
special case.

```typescript
export interface UnknownProp {
  /** The file the usage is in, as given. */
  file: string
  /** 1-based line of the usage. */
  line: number
  /** The offending attribute name. */
  prop: string
}

export interface SourceFile {
  path: string
  contents: string
}

/**
 * Reports every attribute passed to `component` that is not in `allowed`,
 * in file order, then line order, then attribute order.
 */
export function findUnknownProps(
  component: string,
  allowed: string[],
  files: SourceFile[]
): UnknownProp[] {
  // Your implementation here
  return []
}
```

## Tests

```typescript
import { describe, expect, it } from 'vitest'
import { findUnknownProps, type SourceFile } from './solution'

const ALLOWED = ['intent', 'size', 'busy']

function source(path: string, ...lines: string[]): SourceFile {
  return { path, contents: lines.join('\n') }
}

describe('findUnknownProps', () => {
  it('accepts a usage that follows the table', () => {
    const file = source('ok.tsx', '<Button intent="danger" size="compact">Delete</Button>')
    expect(findUnknownProps('Button', ALLOWED, [file])).toEqual([])
  })

  it('reports the famous wrong names, by name', () => {
    const file = source('bad.tsx', '<Button variant="destructive" size="sm">Delete</Button>')
    expect(findUnknownProps('Button', ALLOWED, [file])).toEqual([
      { file: 'bad.tsx', line: 1, prop: 'variant' },
    ])
  })

  it('accepts boolean shorthand from the table', () => {
    const file = source('busy.tsx', '<Button busy intent="primary">Save</Button>')
    expect(findUnknownProps('Button', ALLOWED, [file])).toEqual([])
  })

  it('reports unknown boolean shorthand', () => {
    const file = source('bad.tsx', '<Button disabled intent="primary">Save</Button>')
    expect(findUnknownProps('Button', ALLOWED, [file])).toEqual([
      { file: 'bad.tsx', line: 1, prop: 'disabled' },
    ])
  })

  it('ignores spreads', () => {
    const file = source('spread.tsx', '<Button intent="neutral" {...rest}>Go</Button>')
    expect(findUnknownProps('Button', ALLOWED, [file])).toEqual([])
  })

  it('ignores other components entirely', () => {
    const file = source('other.tsx', '<Link variant="plain">Home</Link>')
    expect(findUnknownProps('Button', ALLOWED, [file])).toEqual([])
  })

  it('reports every offender on a line, in order', () => {
    const file = source('multi.tsx', '<Button variant="x" tone="y" size="compact">A</Button>')
    expect(findUnknownProps('Button', ALLOWED, [file])).toEqual([
      { file: 'multi.tsx', line: 1, prop: 'variant' },
      { file: 'multi.tsx', line: 1, prop: 'tone' },
    ])
  })

  it('carries line numbers through multi-line files', () => {
    const file = source(
      'page.tsx',
      'export function Page() {',
      '  return (',
      '    <Button kind="ghost">Back</Button>',
      '  )',
      '}'
    )
    expect(findUnknownProps('Button', ALLOWED, [file])).toEqual([
      { file: 'page.tsx', line: 3, prop: 'kind' },
    ])
  })

  it('handles an empty file list', () => {
    expect(findUnknownProps('Button', ALLOWED, [])).toEqual([])
  })
})
```

## Solution

```typescript
export interface UnknownProp {
  file: string
  line: number
  prop: string
}

export interface SourceFile {
  path: string
  contents: string
}

/**
 * Reports every attribute passed to `component` that is not in `allowed`,
 * in file order, then line order, then attribute order.
 */
export function findUnknownProps(
  component: string,
  allowed: string[],
  files: SourceFile[]
): UnknownProp[] {
  const findings: UnknownProp[] = []
  const allowedSet = new Set(allowed)
  // The component's opening tag up to `>` — one line is enough context for
  // the overwhelming majority of JSX, and a rule that catches the common
  // case on every commit beats an AST walker nobody maintains.
  const openingTag = new RegExp(`<${component}\\b([^>]*)`, 'g')
  // An attribute is a name with `=` after it, or bare boolean shorthand.
  const attribute = /(?:^|\s)([A-Za-z_][\w-]*)(?==|\s|$)/g

  for (const file of files) {
    const lines = file.contents.split('\n')
    for (let i = 0; i < lines.length; i++) {
      for (const tag of lines[i]!.matchAll(openingTag)) {
        // Spreads are expressions, not names — strip them before the
        // attribute scan so `{...rest}` cannot masquerade as one.
        const body = (tag[1] ?? '').replace(/\{[^}]*\}/g, ' ')
        for (const found of body.matchAll(attribute)) {
          const name = found[1]!
          if (!allowedSet.has(name)) {
            findings.push({ file: file.path, line: i + 1, prop: name })
          }
        }
      }
    }
  }

  return findings
}
```
