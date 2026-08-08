---
slug: ts-context-002
title: 'Give it what it needs: a call against an API you have not read'
description: A model asked to cancel an order will guess the obvious endpoint, and the obvious endpoint deletes the order instead. One source on the menu prevents that. It is the cheapest one.
difficulty: intermediate
type: context
hints:
  - The question is about one route. Which source states routes, rather than describing, logging, or apologizing about them?
  - The full OpenAPI dump contains the answer too. So does a phone book contain your dentist. Cost is part of the score.
  - The guessable endpoint exists and does something else. That is why this needs context at all — a wrong guess here returns 200.
tags:
  - context
  - ai
  - cost
---

You are asking a model to write one client call:

> Cancel order `ord_4821` against our internal API.

It has never seen this API. Left alone it will guess the RESTful default —
`DELETE /api/orders/ord_4821` — which **exists**, returns 200, and permanently
deletes the draft instead of cancelling the live order. Nothing about the
response says "wrong endpoint". That is what makes this dangerous: the guess
is not just plausible, it is *runnable*.

Four things could be shown to the model. Each costs what it costs:

| source | tokens |
| --- | --- |
| The route table | 250 |
| The auth guide | 1200 |
| The support runbook | 2000 |
| The full OpenAPI dump | 4000 |

Pick what to hand over, then write the call. You are scored on being right,
and separately on what it cost. The OpenAPI dump also contains the answer —
buried in four thousand tokens of schemas — and taking it anyway is the habit
this exercise exists to make visible.

```typescript
/**
 * The call, once you have decided what to hand over.
 *
 * Write the fetch. It is checked for shape rather than executed: the right
 * method against the right route — which you cannot know without the one
 * source that states it.
 */
export const answer = ``
```

## Context

```yaml
required:
  - route-table
accept: '(?=[\s\S]*post)(?=[\s\S]*\/api\/orders\/ord_4821\/cancel)'
sources:
  - id: route-table
    label: The route table
    tokens: 250
    content: |
      GET     /api/orders                 list orders
      GET     /api/orders/:id             fetch one order
      POST    /api/orders                 create draft order
      DELETE  /api/orders/:id             delete a DRAFT order (irreversible)
      POST    /api/orders/:id/cancel      cancel a live order (refunds, notifies)
      POST    /api/orders/:id/refund      refund without cancelling
  - id: auth-guide
    label: The auth guide
    tokens: 1200
    content: |
      # Service-to-service auth

      Internal calls carry the service token in the Authorization header.
      Tokens rotate daily at 00:00 UTC; fetch the current one from the
      sidecar at /token …

      … a thousand more tokens about scopes, rotation, and the incident
      that produced this document …
  - id: runbook
    label: The support runbook
    tokens: 2000
    content: |
      # When a customer asks to cancel

      1. Verify the order is not already shipped (see /api/orders/:id).
      2. Cancellations refund automatically; do NOT also hit refund.
      … two thousand tokens of process, escalation paths, and macros …
  - id: openapi
    label: The full OpenAPI dump
    tokens: 4000
    content: |
      openapi: 3.1.0
      paths:
        /api/orders/{id}/cancel:
          post:
            summary: Cancel a live order
      … four thousand tokens of schemas, error envelopes, and examples
      for every endpoint in the service …
```

## Tests

```typescript
import { describe, expect, it } from 'vitest'

/*
 * This exercise is not graded by running the learner's code. It is graded by
 * the context-selection service: what they chose, what it cost, and whether
 * the answer was accepted.
 *
 * These tests keep the exercise's own definition honest — the definition is
 * the thing that decides whether the exercise measures anything.
 */

const REQUIRED = ['route-table']
const SOURCES = [
  { id: 'route-table', tokens: 250 },
  { id: 'auth-guide', tokens: 1200 },
  { id: 'runbook', tokens: 2000 },
  { id: 'openapi', tokens: 4000 },
]
const ACCEPT = /(?=[\s\S]*post)(?=[\s\S]*\/api\/orders\/ord_4821\/cancel)/i

describe('the exercise definition', () => {
  it('has a required source that is on the menu', () => {
    for (const id of REQUIRED) {
      expect(SOURCES.some((source) => source.id === id)).toBe(true)
    }
  })

  it('makes the required source the cheapest', () => {
    // The exercise's whole point: the necessary context costs least. If a
    // pricier source were required, taking everything would be rational.
    const required = SOURCES.find((source) => source.id === REQUIRED[0])!
    for (const source of SOURCES) {
      expect(required.tokens).toBeLessThanOrEqual(source.tokens)
    }
  })

  it('accepts the correct call', () => {
    expect(ACCEPT.test(`await fetch('/api/orders/ord_4821/cancel', { method: 'POST' })`)).toBe(
      true
    )
  })

  it('rejects the guessable DELETE', () => {
    // The trap this exercise is built around: the RESTful guess runs fine
    // and does the wrong thing.
    expect(ACCEPT.test(`await fetch('/api/orders/ord_4821', { method: 'DELETE' })`)).toBe(false)
  })

  it('rejects a refund call', () => {
    expect(
      ACCEPT.test(`await fetch('/api/orders/ord_4821/refund', { method: 'POST' })`)
    ).toBe(false)
  })
})
```

## Solution

```typescript
/**
 * The call, once you have decided what to hand over.
 *
 * The route table (250 tokens) is the only source that STATES the route.
 * The OpenAPI dump also contains it, sixteen times the price, buried in
 * schemas. The auth guide and the runbook describe everything around the
 * call except the call. And the guessable endpoint — DELETE /api/orders/:id
 * — exists, returns 200, and deletes a draft instead of cancelling.
 */
export const answer = `await fetch('/api/orders/ord_4821/cancel', { method: 'POST' })`
```
