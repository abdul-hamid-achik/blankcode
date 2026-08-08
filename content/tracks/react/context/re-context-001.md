---
slug: re-context-001
title: 'Give it what it needs: a design system with its own opinions'
description: A model asked for a destructive small button will write variant="destructive" size="sm" — the names every design system uses except this one. One source states the real props.
difficulty: intermediate
type: context
hints:
  - The question needs two prop names and their allowed values. Which source is the props table, rather than examples, tokens, or philosophy?
  - The Storybook dump demonstrates every combination — you pay for all of them to learn two.
  - shadcn's names are not this system's names. Familiarity is what makes the wrong guess feel typed-checked.
tags:
  - context
  - ai
  - cost
---

You are asking a model to write one JSX element:

> Render the design system's `Button` as a small, destructive action that
> says "Delete workspace".

It has never seen this design system. Left alone it will write
`<Button variant="destructive" size="sm">` — shadcn's names, the ones its
training data has seen ten thousand times. This system says
`intent="danger"` and `size="compact"`, and the wrong props fail the
TypeScript build *after* the model has moved on.

Four things could be shown to it. Each costs what it costs:

| source | tokens |
| --- | --- |
| The Button props table | 220 |
| The Storybook stories dump | 1400 |
| The design tokens file | 2000 |
| The component's full source | 3800 |

Pick what to hand over, then write the element. You are scored on being
right, and separately on what it cost.

```typescript
/**
 * The element, once you have decided what to hand over.
 *
 * Write JSX as a string. It is checked for shape rather than rendered: the
 * right props with the right values — names you cannot know without the one
 * source that states them.
 */
export const answer = ``
```

## Context

```yaml
required:
  - props-table
accept: '(?=[\s\S]*intent)(?=[\s\S]*danger)(?=[\s\S]*size)(?=[\s\S]*compact)'
sources:
  - id: props-table
    label: The Button props table
    tokens: 220
    content: |
      Button props
        intent   "neutral" | "primary" | "danger"     visual weight & color
        size     "regular" | "compact"                height and padding
        busy     boolean                              spinner, disables clicks
        children ReactNode
      (There is no `variant` prop. Legacy `kind` was removed in v4.)
  - id: storybook
    label: The Storybook stories dump
    tokens: 1400
    content: |
      // Button.stories.tsx — every intent × size × busy combination,
      // fourteen hundred tokens of stories in which the two names you
      // need appear alongside every name you do not …
  - id: tokens
    label: The design tokens file
    tokens: 2000
    content: |
      { "color": { "danger": { "600": "#b3261e" } } … two thousand tokens
      of scales that style the button without naming its props …
  - id: source
    label: The component's full source
    tokens: 3800
    content: |
      // button.tsx — thirty-eight hundred tokens of cva calls, forwarded
      // refs, and aria plumbing, with the props interface at the top …
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
  it('uses the real prop names and values', () => {
    for (const needed of ['intent', 'danger', 'size', 'compact', 'Delete workspace']) {
      expect(answer).toContain(needed)
    }
  })

  it('avoids the shadcn guesses', () => {
    // The familiar names are the trap: variant/destructive/sm feel
    // type-checked because training data used them, not because this
    // system does.
    expect(answer).not.toContain('variant')
    expect(answer).not.toContain('destructive')
    expect(answer).not.toContain('"sm"')
  })

  it('is a Button element', () => {
    expect(answer).toContain('<Button')
  })
})
```

## Solution

```typescript
/**
 * The props table (220 tokens) is the only source that STATES the prop
 * names and their unions — intent/danger and size/compact, not the
 * shadcn-shaped variant/destructive/sm. The stories contain them too at six
 * times the price, surrounded by every combination you do not need; the
 * tokens file styles the button without naming a prop; the source states
 * them at seventeen times the price of the table that exists for this.
 */
export const answer = `<Button intent="danger" size="compact">Delete workspace</Button>`
```
