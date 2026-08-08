---
slug: ts-tool-002
title: 'Build the tool: find the template that breaks hydration'
description: One bare template element inside a Vue page made the server and the client disagree about the whole page. Reading did not find it. Write the rule that does.
difficulty: intermediate
type: challenge
hints:
  - The root <template> of an SFC is fine — it is the nested bare one that compiles differently on each side. Track whether you are inside the root before flagging.
  - A template carrying v-if, v-for or v-slot (or its # shorthand) is legitimate. The tell is a template with none of them.
  - Attributes can be spread across the tag. Check the whole opening tag, not just the characters right after "template".
tags:
  - tooling
  - vue
  - hydration
---

This exercise is real. This platform shipped a progress page that hydrated
with `Hydration completed but contains mismatches` — after which client-side
navigation misrendered until a hard refresh. The cause was one line: a
nested `<template>` element with no directive. The server compiler emits
fragment markers for it; the client compiler builds different vnodes; the
two sides disagree forever after.

Nobody found it by reading — the wrapper looks harmless, which is why it
survived review. A sweep found it in milliseconds, and the fix was deleting
the wrapper. The sweep deserves to exist as a rule.

Write `findBareTemplates`. It scans Vue single-file components and reports
every *nested* `<template>` whose opening tag carries none of `v-if`,
`v-else-if`, `v-else`, `v-for`, `v-slot`, or the `#` slot shorthand. The
root `<template>` of the SFC — the first one in the file — is the component
body and is never reported.

```typescript
export interface BareTemplate {
  /** The file the template is in, as given. */
  file: string
  /** 1-based line of the offending opening tag. */
  line: number
}

export interface SfcFile {
  path: string
  contents: string
}

/**
 * Reports every nested bare <template> — one with no v-if / v-else-if /
 * v-else / v-for / v-slot / # shorthand on its opening tag. The first
 * <template> in each file is the SFC root and is exempt.
 */
export function findBareTemplates(files: SfcFile[]): BareTemplate[] {
  // Your implementation here
  return []
}
```

## Tests

```typescript
import { describe, expect, it } from 'vitest'
import { findBareTemplates, type SfcFile } from './solution'

function sfc(path: string, body: string): SfcFile {
  return { path, contents: body }
}

describe('findBareTemplates', () => {
  it('reports a nested bare template with its line', () => {
    const file = sfc(
      'pages/progress.vue',
      ['<template>', '  <div>', '    <template>', '      <p>hi</p>', '    </template>', '  </div>', '</template>'].join(
        '\n'
      )
    )
    expect(findBareTemplates([file])).toEqual([{ file: 'pages/progress.vue', line: 3 }])
  })

  it('never reports the SFC root template', () => {
    const file = sfc('pages/clean.vue', ['<template>', '  <div />', '</template>'].join('\n'))
    expect(findBareTemplates([file])).toEqual([])
  })

  it('accepts templates carrying structural directives', () => {
    const file = sfc(
      'pages/list.vue',
      [
        '<template>',
        '  <template v-if="ready">',
        '    <p>a</p>',
        '  </template>',
        '  <template v-for="item in items" :key="item">',
        '    <p>{{ item }}</p>',
        '  </template>',
        '  <template v-else>',
        '    <p>b</p>',
        '  </template>',
        '</template>',
      ].join('\n')
    )
    expect(findBareTemplates([file])).toEqual([])
  })

  it('accepts slot templates, including the # shorthand', () => {
    const file = sfc(
      'pages/slots.vue',
      [
        '<template>',
        '  <Card>',
        '    <template v-slot:header>',
        '      <p>title</p>',
        '    </template>',
        '    <template #action>',
        '      <button>go</button>',
        '    </template>',
        '  </Card>',
        '</template>',
      ].join('\n')
    )
    expect(findBareTemplates([file])).toEqual([])
  })

  it('reports every offender across files', () => {
    const clean = sfc('a.vue', ['<template>', '  <div />', '</template>'].join('\n'))
    const dirty = sfc(
      'b.vue',
      ['<template>', '  <template>', '    <p />', '  </template>', '</template>'].join('\n')
    )
    const findings = findBareTemplates([clean, dirty])
    expect(findings).toEqual([{ file: 'b.vue', line: 2 }])
  })

  it('flags a bare template even after a directive-carrying one', () => {
    // Order must not launder the offender: one legitimate template does not
    // excuse the bare one after it.
    const file = sfc(
      'c.vue',
      [
        '<template>',
        '  <template v-if="x">',
        '    <p />',
        '  </template>',
        '  <template>',
        '    <p />',
        '  </template>',
        '</template>',
      ].join('\n')
    )
    expect(findBareTemplates([file])).toEqual([{ file: 'c.vue', line: 5 }])
  })

  it('handles an empty file list', () => {
    expect(findBareTemplates([])).toEqual([])
  })
})
```

## Solution

```typescript
export interface BareTemplate {
  file: string
  line: number
}

export interface SfcFile {
  path: string
  contents: string
}

/**
 * Reports every nested bare <template> — one with no v-if / v-else-if /
 * v-else / v-for / v-slot / # shorthand on its opening tag. The first
 * <template> in each file is the SFC root and is exempt.
 */
export function findBareTemplates(files: SfcFile[]): BareTemplate[] {
  const findings: BareTemplate[] = []

  for (const file of files) {
    // The first opening <template> is the SFC root — the component body,
    // exempt by definition. Everything after it is markup, where a bare
    // template is the hydration bug this rule exists to catch.
    let sawRoot = false
    const lines = file.contents.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const match = /<template(\s[^>]*)?>/.exec(lines[i] ?? '')
      if (!match) continue

      if (!sawRoot) {
        sawRoot = true
        continue
      }

      const attributes = match[1] ?? ''
      // A directive gives the template a compile-time meaning both sides
      // agree on. Bare is what desynchronizes them.
      const hasDirective = /(v-if|v-else-if|v-else|v-for|v-slot|#)/.test(attributes)
      if (!hasDirective) {
        findings.push({ file: file.path, line: i + 1 })
      }
    }
  }

  return findings
}
```
