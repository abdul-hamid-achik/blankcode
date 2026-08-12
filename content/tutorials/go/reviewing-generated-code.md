---
title: "Reviewing Code You Did Not Write"
slug: "go-reviewing-generated-code"
description: "Generated code fails where the spec was silent, and its tests inherit the same blind spots — review the inputs a passing suite never used, not the style of the code."
track: "go"
order: 6
difficulty: "intermediate"
tags: ["code-review", "ai", "testing", "concurrency", "off-by-one"]
practice:
  concept: "code-review"
  label: "Code review"
---

Most review habits assume a human author. You skim for the smell of a rushed commit — the gnarly branch, the copy-paste block, the variable named `tmp2`. Generated code defeats that instinct completely: it arrives formatted, documented, consistently named, and tested. Nothing smells. The defect is still there, but it lives somewhere your instincts were never trained to look — in a decision, not in a mess.

## The bugs live where the spec was silent

Human bugs cluster around fatigue and complexity. Generated bugs cluster around ambiguity: every clause your request left open, the model closed with a choice, and it does not tell you which choice it made. Ask for "a helper that fetches every page" and something has to decide what happens when the last page is partial. Ask for "save all the items" and something has to decide whether the function waits for the goroutines it started.

The choice arrives wearing the same confident prose as everything else. That is what makes this class of review hard: the wrong reading of your spec is rendered as fluently as the right one, with a doc comment asserting the behavior you wanted, above code that does something else. So skip the style read entirely. List the decisions the spec forced — boundary behavior, error behavior, ordering, concurrency — and check which way each one actually went.

## A passing suite proves agreement, not correctness

When the code and its tests come from the same author in the same conversation, they encode the same reading of the spec. A green run proves the two halves agree with each other — not that either agrees with you.

This pagination helper shipped with tests, and the tests pass:

```go
import "math"

func FetchAll[T any](fetchPage func(offset, limit int) (items []T, total int), pageSize int) []T {
	first, total := fetchPage(0, pageSize)
	all := append([]T{}, first...)
	pageCount := int(math.Floor(float64(total) / float64(pageSize)))

	for page := 1; page < pageCount; page++ {
		next, _ := fetchPage(page*pageSize, pageSize)
		all = append(all, next...)
	}
	return all
}
```

`math.Floor` drops the partial page. Run it against 25 records with a page size of 10 and it returns 20 — `floor(2.5)` is 2 pages, and the last 5 records never get fetched. Nothing panics. The result has the right shape, in the right order, just short.

The suite passes anyway, because every total it tries divides evenly by the page size: 30 records, 10 per page. The same misreading that wrote `Floor` picked the fixtures — a suite born from the bug cannot see the bug. It even passes for 9 records, by accident: `floor(0.9)` is 0 pages, the loop never runs, and the first fetch already had everything.

::code-blank{lang="go" href="/tracks/go/code-review" label="practice code review for real"}
---
code: |
  pageCount := int(math.___blank_start___Ceil___blank_end___(float64(total) / float64(pageSize)))
---
::

## Read the tests for their inputs, not their assertions

The fastest route to the defect is not reading the implementation harder. It is reading the tests and listing what they never feed the code. Partition the input space — divides evenly or not, empty or not, one item or many, succeeds or fails — and mark which classes the fixtures actually visit. The unvisited classes are the review agenda, in priority order.

Then take the smallest input from an unvisited class and trace it by hand. Twenty-five records, page size 10: `total / pageSize` is 2.5, `Floor` makes it 2, the loop fetches page 1 and stops. Thirty seconds of arithmetic finds what an hour of reading the loop for "off-by-one vibes" does not, because the arithmetic checks the decision and the reading checks the style.

## The goroutine that never waits

Some decisions hide deeper than fixtures. This batch-save helper also shipped green:

```go
func SaveAll[T any](items []T, save func(T) T) []T {
	results := make([]T, len(items))
	for i, item := range items {
		go func(i int, item T) {
			results[i] = save(item)
		}(i, item)
	}
	return results
}
```

Each `go` schedules work and returns immediately, so `SaveAll` returns before any `save` finishes. The function *looks* concurrent — slots preallocated, indices captured correctly — which is exactly why it survives review. The concurrency just is not joined to the return.

The suite passed for two reasons, and the second is the one worth keeping. First, it asserted that `save` was *called* — true the moment the loop finishes scheduling. Second, its mock returned instantly, and an instant `save` can finish before the test looks at the slice: with a pure `func(v int) int { return v }`, a flaky schedule can make the test pass. Give `save` one real timer tick and the same caller receives a slice of zeros on return — and the same slice holds the real values a few milliseconds later. A mock does not just fake data; it fakes *timing*, and a green suite can be load-bearing on the difference.

The fix is not a heavier mock. It is waiting for the work the function claims to do:

::code-blank{lang="go" href="/tracks/go/code-review" label="practice code review for real"}
---
code: |
  var wg sync.WaitGroup
  for i, item := range items {
    wg.Add(1)
    go func(i int, item T) {
      defer wg.Done()
      results[i] = save(item)
    }(i, item)
  }
  wg.___blank_start___Wait___blank_end___()
---
::

## Where this bites

**Reviewing the code before the tests.** The tests are a record of which inputs the author considered; everything absent from them is unverified by construction. Start with the fixture list, not the function body.

**Trusting a suite whose fixtures are all round numbers.** Totals that divide evenly, mocks that return instantly, inputs that never fail — each one is a class of behavior the green checkmark says nothing about. If every number in the suite is convenient, assume the boundary is wrong until you trace it.

**Accepting a fix that silences the symptom.** When generated error handling swallows a failure and a later, louder failure gets reported instead, guarding the loud one makes the report quieter and the diagnosis worse. The fix is whatever makes the *first* failure the one the caller sees.

**Asking the model to review its own output in the same conversation.** It re-reads the code with the same reading of the spec that produced it — the one thing a reviewer is there to not share. Fresh review needs fresh context: a new session with the spec restated, or you, with the fixture list and a boundary traced by hand.
