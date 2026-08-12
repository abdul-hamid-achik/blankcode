---
title: "Reviewing Code You Did Not Write"
slug: "react-reviewing-generated-code"
description: "Generated code fails where the spec was silent, and its tests inherit the same blind spots — review the inputs a passing suite never used, not the style of the code."
track: "react"
order: 5
difficulty: "intermediate"
tags: ["code-review", "ai", "testing", "async", "off-by-one"]
practice:
  concept: "code-review"
  label: "Code review"
---

Most review habits assume a human author. You skim for the smell of a rushed commit — the gnarly branch, the copy-paste block, the variable named `tmp2`. Generated code defeats that instinct completely: it arrives formatted, documented, consistently named, and tested. Nothing smells. The defect is still there, but it lives somewhere your instincts were never trained to look — in a decision, not in a mess.

## The bugs live where the spec was silent

Human bugs cluster around fatigue and complexity. Generated bugs cluster around ambiguity: every clause your request left open, the model closed with a choice, and it does not tell you which choice it made. Ask for "a helper that fetches every page" and something has to decide what happens when the last page is partial. Ask for "save all the items" and something has to decide whether the function awaits the work it started.

The choice arrives wearing the same confident prose as everything else. That is what makes this class of review hard: the wrong reading of your spec is rendered as fluently as the right one. So skip the style read entirely. List the decisions the spec forced — boundary behavior, error behavior, ordering, concurrency — and check which way each one actually went.

## A passing suite proves agreement, not correctness

When the code and its tests come from the same author in the same conversation, they encode the same reading of the spec. A green run proves the two halves agree with each other — not that either agrees with you.

This pagination helper shipped with tests, and the tests pass:

```typescript
export async function fetchAll<T>(
  fetchPage: (offset: number, limit: number) => Promise<{ items: T[]; total: number }>,
  pageSize = 10
): Promise<T[]> {
  const first = await fetchPage(0, pageSize)
  const all = [...first.items]
  const pageCount = Math.floor(first.total / pageSize)

  for (let page = 1; page < pageCount; page++) {
    const next = await fetchPage(page * pageSize, pageSize)
    all.push(...next.items)
  }
  return all
}
```

`Math.floor` drops the partial page. Run it against 25 records with a page size of 10 and it returns 20 — `floor(2.5)` is 2 pages, and the last 5 records never get fetched. Nothing throws. The result has the right shape, just short.

The suite passes anyway, because every total it tries divides evenly by the page size. The same misreading that wrote `floor` picked the fixtures — a suite born from the bug cannot see the bug.

::code-blank{lang="typescript" href="/tracks/react/code-review" label="practice code review for real"}
---
code: |
  const pageCount = Math.___blank_start___ceil___blank_end___(first.total / pageSize)
---
::

## Read the tests for their inputs, not their assertions

The fastest route to the defect is not reading the implementation harder. It is reading the tests and listing what they never feed the code. Partition the input space — divides evenly or not, empty or not, one item or many, succeeds or fails — and mark which classes the fixtures actually visit. The unvisited classes are the review agenda, in priority order.

Then take the smallest input from an unvisited class and trace it by hand. Twenty-five records, page size 10: arithmetic finds what an hour of reading the loop for "off-by-one vibes" does not.

## The await aimed at nothing

Some decisions hide deeper than fixtures. This batch-save helper also shipped green:

```typescript
export async function saveAll<T>(
  items: T[],
  save: (item: T) => Promise<T>
): Promise<T[]> {
  const results: T[] = []
  items.forEach(async (item) => {
    const saved = await save(item)
    results.push(saved)
  })
  return results
}
```

`forEach` throws away the promises its async callback returns, so `saveAll` returns immediately and `results` fills in later, unobserved. The function contains an `await`, which is exactly why it survives review. The `await` just is not aimed at anything the function waits for.

The suite passed for two reasons. First, it asserted that `save` was *called*. Second, its mock resolved instantly. Give `save` one real timer tick and the same caller receives 0 items. A mock does not just fake data; it fakes *timing*.

The fix is a loop the language can await:

::code-blank{lang="typescript" href="/tracks/react/code-review" label="practice code review for real"}
---
code: |
  for (const item of items) {
    results.push(___blank_start___await___blank_end___ save(item))
  }
---
::

## Where this bites

**Reviewing the code before the tests.** The tests are a record of which inputs the author considered; everything absent from them is unverified by construction.

**Trusting a suite whose fixtures are all round numbers.** Totals that divide evenly, mocks that resolve instantly — each one is a class of behavior the green checkmark says nothing about.

**Accepting a fix that silences the symptom.** Guarding a loud failure while the first one is still swallowed makes the report quieter and the diagnosis worse.

**Asking the model to review its own output in the same conversation.** It re-reads the code with the same reading of the spec that produced it. Fresh review needs fresh context.
