---
slug: ts-context-001
title: 'Give it what it needs: a query against a schema it has never seen'
description: A model cannot write this query without being shown something. Four things are on offer and only one is necessary. Handing over all four is allowed, costs sixteen times as much, and is what most people do.
difficulty: intermediate
type: context
hints:
  - Read the question first and ask what a competent person would need in front of them to answer it. Not what would be nice to have — what is required.
  - The manual is the expensive one and it is almost never the answer. Documentation tells you how a tool works; it does not tell you what is in this database.
  - Sample rows look useful and usually are not. They show you data you already know the shape of, once you have the shape.
tags:
  - context
  - ai
  - cost
---

You are asking a model to write one query:

> Return the total value of orders placed in the last thirty days, per customer,
> highest first.

It has never seen this database. Left alone it will invent column names that
sound right — `amount`, `created_at`, `user_id` — and produce something that
looks correct and does not run.

Four things could be shown to it. Each costs what it costs:

| source | tokens |
| --- | --- |
| Table definitions | 400 |
| Twenty example rows | 900 |
| The whole ORM manual | 6000 |
| Yesterday of slow queries | 3000 |

Pick what to hand over, then write the query. You are scored on being right,
and separately on what it cost — the two are reported apart on purpose, because
a right answer bought for sixteen times the necessary price is a habit worth
seeing.

There is no penalty for taking everything, and taking everything is what most
people do. That is the point of the exercise.

```typescript
/**
 * The query, once you have decided what to hand over.
 *
 * Write SQL. It is checked for shape rather than executed: a `select` over
 * `orders` that aggregates and groups. What is being graded is whether you
 * knew which columns exist — which you cannot, unless you asked for the one
 * source that says so.
 */
export const answer = ``
```

## Context

```yaml
required:
  - schema
accept: 'select[\s\S]*sum[\s\S]*orders[\s\S]*group\s+by'
sources:
  - id: schema
    label: Table definitions
    tokens: 400
    content: |
      create table customers (
        id uuid primary key,
        name text not null,
        signed_up_at timestamptz not null
      );

      create table orders (
        id uuid primary key,
        customer_id uuid not null references customers(id),
        total_cents integer not null,
        placed_at timestamptz not null
      );
  - id: sample-rows
    label: Twenty example rows
    tokens: 900
    content: |
      id,customer_id,total_cents,placed_at
      3f1c…,9ab2…,1299,2026-07-31T09:12:04Z
      7d40…,9ab2…,4550,2026-07-30T17:45:22Z
      … eighteen more rows in the same shape …
  - id: orm-docs
    label: The whole ORM manual
    tokens: 6000
    content: |
      # Querying

      Use `db.select()` to begin a query. Chain `.from()`, `.where()`,
      `.groupBy()` and `.orderBy()`. Aggregates live in `drizzle-orm`:
      `sum`, `count`, `avg`, `min`, `max`.

      … five thousand more tokens about migrations, relations, prepared
      statements, and the four ways to express a join …
  - id: slow-query-log
    label: Yesterday of slow queries
    tokens: 3000
    content: |
      2026-08-05 03:14:22  1284ms  SELECT * FROM orders WHERE placed_at > $1
      2026-08-05 04:02:11   932ms  SELECT * FROM customers ORDER BY signed_up_at
      … four hundred more lines of the same …
```

## Tests

```typescript
import { describe, expect, it } from 'vitest'

/*
 * This exercise is not graded by running the learner's code. It is graded by
 * the context-selection service: what they chose, what it cost, and whether the
 * answer was accepted.
 *
 * These tests exist to keep the exercise's own definition honest, because the
 * definition is the thing that decides whether the exercise measures anything.
 */

const REQUIRED = ['schema']
const SOURCES = [
  { id: 'schema', tokens: 400 },
  { id: 'sample-rows', tokens: 900 },
  { id: 'orm-docs', tokens: 6000 },
  { id: 'slow-query-log', tokens: 3000 },
]

describe('the exercise definition', () => {
  it('has a required source that is on the menu', () => {
    for (const id of REQUIRED) {
      expect(SOURCES.some((source) => source.id === id)).toBe(true)
    }
  })

  it('makes the wrong choice expensive enough to notice', () => {
    // If the decoys were cheap the exercise would have no teeth: everyone takes
    // everything and the report says almost nothing.
    const minimal = SOURCES.filter((s) => REQUIRED.includes(s.id)).reduce((n, s) => n + s.tokens, 0)
    const everything = SOURCES.reduce((n, s) => n + s.tokens, 0)
    expect(everything / minimal).toBeGreaterThan(10)
  })

  it('does not make the required source the cheapest by accident', () => {
    // It happens to be cheapest here, and that is fine — but the lesson is
    // "what is needed", not "what is cheap", so this is asserted deliberately
    // rather than relied on.
    const required = SOURCES.find((s) => s.id === REQUIRED[0])
    expect(required?.tokens).toBe(400)
  })

  it('accepts a correct aggregate query', () => {
    const accept = new RegExp('select[\\s\\S]*sum[\\s\\S]*orders[\\s\\S]*group\\s+by', 'i')
    expect(
      accept.test(
        'select customer_id, sum(total_cents) from orders where placed_at > now() - interval \'30 days\' group by customer_id order by 2 desc'
      )
    ).toBe(true)
  })

  it('rejects a query that forgets to aggregate', () => {
    const accept = new RegExp('select[\\s\\S]*sum[\\s\\S]*orders[\\s\\S]*group\\s+by', 'i')
    expect(accept.test('select * from orders')).toBe(false)
  })
})
```

## Solution

```typescript
/*
 * The answer is: take the schema, and nothing else.
 *
 * The question is about columns and their names. Only one source carries those.
 * The other three are the shapes a wrong instinct takes:
 *
 * - The manual explains how the ORM works. The model already knows that; it
 *   does not know what is in this database. Six thousand tokens for nothing.
 * - Sample rows show data whose shape the schema already gave you. They feel
 *   like evidence and add nothing the first source did not.
 * - The slow query log is about performance, which is a different question than
 *   the one being asked. Context that answers a question nobody asked is the
 *   most common kind of waste.
 *
 * Four hundred tokens. Handing over all four costs 10,300 — twenty-five times
 * as much for the same answer, and a longer context in which the model is
 * measurably more likely to reach for the wrong column.
 */

// select customer_id, sum(total_cents) as total
// from orders
// where placed_at > now() - interval '30 days'
// group by customer_id
// order by total desc
export const answer = `select customer_id, sum(total_cents) as total
from orders
where placed_at > now() - interval '30 days'
group by customer_id
order by total desc`
```
