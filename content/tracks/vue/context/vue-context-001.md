---
slug: vue-context-001
title: 'Give it what it needs: a toast API that is not the famous one'
description: A model asked to show an error toast will write toast.error(message) — the API of every library it has read. This team's composable works differently, and one cheap source says how.
difficulty: intermediate
type: context
hints:
  - The question needs a method name and an options shape. Which source is the signature, rather than usage folklore or theming?
  - The migration guide explains why .error() was removed. Knowing the history costs ten times knowing the replacement.
  - Popular APIs are the trap; the model has read vue-toastification more times than your codebase.
tags:
  - context
  - ai
  - cost
---

You are asking a model to write one call:

> Show an error toast that says "Import failed" using the team's `useToast`
> composable.

It has never seen this codebase. Left alone it will write
`toast.error('Import failed')` — the API of vue-toastification and every
library like it, seen thousands of times in training. This team's
composable has one method, `push`, taking an options object with a `tone` —
and `.error()` was deliberately removed in the last migration. The guess
throws `toast.error is not a function` at runtime, in the error path, which
is the last place anyone looks.

Four things could be shown to it. Each costs what it costs:

| source | tokens |
| --- | --- |
| The useToast signature | 190 |
| A component that uses it | 950 |
| The v3 migration guide | 2100 |
| The toast theme reference | 3600 |

Pick what to hand over, then write the call. You are scored on being right,
and separately on what it cost.

```typescript
/**
 * The call, once you have decided what to hand over.
 *
 * Write it as source. It is checked for shape rather than executed: the
 * right method with the right options — a shape you cannot know without the
 * one source that states it.
 */
export const answer = ``
```

## Context

```yaml
required:
  - signature
accept: '(?=[\s\S]*useToast)(?=[\s\S]*push)(?=[\s\S]*tone)(?=[\s\S]*critical)(?=[\s\S]*Import failed)'
sources:
  - id: signature
    label: The useToast signature
    tokens: 190
    content: |
      export interface ToastOptions {
        tone: 'neutral' | 'success' | 'critical'
        body: string
        /** ms; 0 pins it until dismissed. Defaults to 5000. */
        timeoutMs?: number
      }
      export function useToast(): { push(options: ToastOptions): void }
      // There is no .error/.success sugar — removed in v3, see migration.
  - id: component-usage
    label: A component that uses it
    tokens: 950
    content: |
      <!-- ImportPanel.vue — nine hundred tokens of a real component in
      which push() appears twice, surrounded by upload plumbing … -->
  - id: migration-guide
    label: The v3 migration guide
    tokens: 2100
    content: |
      # Toasts v3

      The per-severity methods multiplied: error, warn, info, success,
      criticalPersistent … v3 collapses them into push({ tone }) …
      twenty-one hundred tokens of history and codemods …
  - id: theme-reference
    label: The toast theme reference
    tokens: 3600
    content: |
      … thirty-six hundred tokens of tone-to-token mappings, animation
      timings, and z-index policy — everything about toasts except how to
      show one …
```

## Tests

```typescript
import { describe, expect, it } from 'vitest'
import { answer } from './solution'

/*
 * This exercise is not graded by running the learner's code. It is graded
 * by the context-selection service: what they chose, what it cost, and
 * whether the answer was accepted.
 *
 * These tests keep the exercise's own definition honest — the definition is
 * the thing that decides whether the exercise measures anything.
 */

describe('the reference answer', () => {
  it('uses the real API shape', () => {
    for (const needed of ['useToast', 'push', 'tone', 'critical', 'Import failed']) {
      expect(answer).toContain(needed)
    }
  })

  it('avoids the famous-library guess', () => {
    // .error() is the API the model has read ten thousand times. It throws
    // at runtime here — in the error path, where nobody is watching.
    expect(answer).not.toContain('.error(')
    expect(answer).not.toContain(".warning(")
  })
})
```

## Solution

```typescript
/**
 * The signature (190 tokens) is the only source that STATES the shape —
 * push({ tone, body }), no per-severity sugar. The component shows it at
 * five times the price inside upload plumbing; the migration guide explains
 * the removal without stating the replacement compactly; the theme
 * reference styles toasts without showing one.
 */
export const answer = `useToast().push({ tone: 'critical', body: 'Import failed' })`
```
