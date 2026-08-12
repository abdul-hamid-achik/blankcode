---
title: "Reviewing Code You Did Not Write"
slug: "rust-reviewing-generated-code"
description: "Generated code fails where the spec was silent, and its tests inherit the same blind spots — review the inputs a passing suite never used, not the style of the code."
track: "rust"
order: 5
difficulty: "intermediate"
tags: ["code-review", "ai", "testing", "threads", "off-by-one"]
practice:
  concept: "code-review"
  label: "Code review"
---

Most review habits assume a human author. You skim for the smell of a rushed commit — the gnarly branch, the copy-paste block, the variable named `tmp2`. Generated code defeats that instinct completely: it arrives formatted, documented, consistently named, and tested. Nothing smells. The defect is still there, but it lives somewhere your instincts were never trained to look — in a decision, not in a mess.

## The bugs live where the spec was silent

Human bugs cluster around fatigue and complexity. Generated bugs cluster around ambiguity: every clause your request left open, the model closed with a choice, and it does not tell you which choice it made. Ask for "a helper that fetches every page" and something has to decide what happens when the last page is partial. Ask for "save all the items" and something has to decide whether the function joins the threads it spawned.

The choice arrives wearing the same confident prose as everything else. That is what makes this class of review hard: the wrong reading of your spec is rendered as fluently as the right one, with a doc comment asserting the behavior you wanted, above code that does something else. So skip the style read entirely. List the decisions the spec forced — boundary behavior, error behavior, ordering, concurrency — and check which way each one actually went.

## A passing suite proves agreement, not correctness

When the code and its tests come from the same author in the same conversation, they encode the same reading of the spec. A green run proves the two halves agree with each other — not that either agrees with you.

This pagination helper shipped with tests, and the tests pass:

```rust
fn fetch_all<T: Clone>(
    mut fetch_page: impl FnMut(usize, usize) -> (Vec<T>, usize),
    page_size: usize,
) -> Vec<T> {
    let (first, total) = fetch_page(0, page_size);
    let mut all = first;
    // Integer division truncates toward zero — the partial page disappears.
    let page_count = total / page_size;

    for page in 1..page_count {
        let (next, _) = fetch_page(page * page_size, page_size);
        all.extend(next);
    }
    all
}
```

Integer division drops the partial page. Run it against 25 records with a page size of 10 and it returns 20 — `25 / 10` is 2 pages, and the last 5 records never get fetched. Nothing panics. The result has the right shape, in the right order, just short.

The suite passes anyway, because every total it tries divides evenly by the page size: 30 records, 10 per page. The same misreading that wrote `/` picked the fixtures — a suite born from the bug cannot see the bug. It even passes for 9 records, by accident: `9 / 10` is 0 pages, the loop never runs, and the first fetch already had everything.

::code-blank{lang="rust" href="/tracks/rust/code-review" label="practice code review for real"}
---
code: |
  let page_count = (total + page_size - 1) / ___blank_start___page_size___blank_end___;
---
::

## Read the tests for their inputs, not their assertions

The fastest route to the defect is not reading the implementation harder. It is reading the tests and listing what they never feed the code. Partition the input space — divides evenly or not, empty or not, one item or many, succeeds or fails — and mark which classes the fixtures actually visit. The unvisited classes are the review agenda, in priority order.

Then take the smallest input from an unvisited class and trace it by hand. Twenty-five records, page size 10: integer division yields 2, the loop fetches page 1 and stops. Thirty seconds of arithmetic finds what an hour of reading the loop for "off-by-one vibes" does not, because the arithmetic checks the decision and the reading checks the style.

## The thread that never joins

Some decisions hide deeper than fixtures. This batch-save helper also shipped green:

```rust
use std::thread;

fn save_all<T, U, F>(items: Vec<T>, save: F) -> Vec<U>
where
    T: Send + 'static,
    U: Send + Default + 'static,
    F: Fn(T) -> U + Send + Sync + 'static,
{
    let n = items.len();
    let mut results = vec![U::default(); n];
    let save = std::sync::Arc::new(save);
    let mut handles = Vec::with_capacity(n);

    for item in items {
        let save = std::sync::Arc::clone(&save);
        // Spawned… and the JoinHandle is never joined before return.
        handles.push(thread::spawn(move || save(item)));
    }
    // Threads still running; results never written.
    let _ = handles;
    results
}
```

Each `spawn` schedules work and returns immediately, so `save_all` returns a vector of defaults before any `save` finishes. The function *looks* concurrent — handles collected in a `Vec` — which is exactly why it survives review. The concurrency just is not joined to the return: the handles are dropped, never `.join()`ed, and nothing ever writes into `results`.

The suite passed for two reasons, and the second is the one worth keeping. First, it asserted that `save` was *called* — true once the spawns are scheduled. Second, its mock returned instantly, and an instant save can race past the assertion. Give `save` one real timer tick and the caller receives defaults on return. A mock does not just fake data; it fakes *timing*, and a green suite can be load-bearing on the difference.

The fix is not a heavier mock. It is joining each handle into the slot:

::code-blank{lang="rust" href="/tracks/rust/code-review" label="practice code review for real"}
---
code: |
  for (i, handle) in handles.into_iter().enumerate() {
      results[i] = handle.___blank_start___join___blank_end___().unwrap();
  }
---
::

## Where this bites

**Reviewing the code before the tests.** The tests are a record of which inputs the author considered; everything absent from them is unverified by construction. Start with the fixture list, not the function body.

**Trusting a suite whose fixtures are all round numbers.** Totals that divide evenly, mocks that return instantly, inputs that never fail — each one is a class of behavior the green checkmark says nothing about. If every number in the suite is convenient, assume the boundary is wrong until you trace it.

**Accepting a fix that silences the symptom.** When generated error handling swallows a failure and a later, louder failure gets reported instead, guarding the loud one makes the report quieter and the diagnosis worse. The fix is whatever makes the *first* failure the one the caller sees.

**Asking the model to review its own output in the same conversation.** It re-reads the code with the same reading of the spec that produced it — the one thing a reviewer is there to not share. Fresh review needs fresh context: a new session with the spec restated, or you, with the fixture list and a boundary traced by hand.
