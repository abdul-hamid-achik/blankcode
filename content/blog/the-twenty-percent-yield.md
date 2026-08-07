---
title: 'The 20% yield: what happened when we generated exercises with a strong model'
description: Five exercises came out of the generator and all five passed every static check we have. Then we ran them. Four did not work.
date: '2026-08-07'
author: BlankCode
tags:
  - ai
  - tooling
  - quality
---

The generator on this project produces exercises: a task description, a code
block with blanks in it, a test suite, a reference solution. It is the obvious
way to grow a corpus, and today it produced five exercises across five concepts.

All five passed `content:validate` clean — 0 fatal, 0 error, 0 warning. Then
they were executed in the sandbox, the way a learner would execute them.

Four of the five did not work.

## What the four were

**A duplicate identifier.** The same name declared twice in one file. This is
not subtle and it is not a judgment call; the compiler simply refuses.

**An import of a package that is not installed.** The runner images contain one
toolchain and a fixed set of libraries. The generated test imported something
outside that set, which fails during collection — a failure that reads, to
somebody solving the exercise, like their own code being wrong.

**A test that disagreed with its own reference solution.** The exercise shipped
with a solution and a suite, and the suite rejected the solution. This is the
worst of the four, because both artifacts are individually plausible and the
contradiction only exists between them.

**A missing import.** The solution used a name it never brought into scope.

Not one of those is a deep problem. Every one of them is the kind of thing a
compiler or a test runner reports in under a second, with a precise message,
the first time it runs.

## Why the validator passed all five

The static validator is not weak. It checks around twenty things, most of which
exist because something in the corpus was already broken in that specific way:
YAML that fails to parse, a blank containing a newline, a blank whose answer
starts with an underscore, token-unbalanced blank boundaries, a test that never
asserts, a slug that collides with another file's, a starter block that is not
the first fenced block.

Every one of those is a property of the file. You can decide it by reading the
text, and the validator reads the text very carefully.

"This program runs" is not a property of the file. It is a property of the file
*plus an environment plus a runtime* — which packages are present, which Python
version, whether the test runner's collection phase can import the module. No
amount of reading gets you there, which is the same finding as
[eleven exercises nobody could solve](/blog/run-your-content-before-you-ship-it),
arriving from the other direction: that time the content was written by people,
this time by a model, and the checks that failed to catch it were the same
checks.

## The upgrade moved the failure, it did not remove it

Earlier the same day the generator was failing differently. A cheap model —
`deepseek-v4-flash` — could not hold the exercise format at all. Six attempts,
nothing usable: invalid YAML from a hint starting with a backtick, quotes inside
a blank where per-blank feedback is an exact compare, so the other quote style
grades as wrong.

Two attempts at fixing that by prompting did nothing; the next generation broke
the same rule. An instruction a model can ignore is not a constraint. What
worked was making the generator run `validateExerciseSource` — the same function
`content:validate` runs — and refuse to save any file with a fatal or an error,
telling the retry exactly which rule it broke.

Then the gate rejected everything from that model, which was the actual finding.
The default changed to a stronger one, and it passed first try, then five for
five.

So the sequence is worth stating plainly. With a weak model, output failed a
static check and was visibly unusable. With a strong model, output passed every
static check and four fifths of it was still unusable. The upgrade did not
remove the failure. It moved the failure to a place where it looks like success,
which is more expensive, because a broken thing that announces itself costs a
retry and a broken thing that does not costs a shipped exercise.

## One trap worth naming

The validator gate did nothing for a full cycle, because the generator runs from
`dist/` and nothing had rebuilt it. From the outside this was indistinguishable
from a gate that was running and approving files it should have rejected — we
spent time doubting the rules instead of doubting whether they were loaded.

A gate you cannot see running is the same as a gate that approves everything.
If a check can silently not execute, it needs to say what it examined, not just
what it concluded.

## The number

Five generated. Five clean statically. One that actually runs.

Twenty percent, with a strong model and a validator that has been sharpened
against a real corpus all week. That number is the whole argument. Bulk
generation is not a way to grow a corpus at a 20% yield with the failures
arriving silently — every batch of ten is eight files that look finished, read
well, and cannot be solved by anybody.

The four were deleted. The one that survived is a decorator-factory exercise in
the Python functions track, and it is
[live](/tracks/python) because it was run, not because it was generated.

## What has to change

The gate is in the wrong place. Right now generation happens, then verification
happens, and a human deletes what failed. That is a review step wearing a
tool's clothes.

The version that would actually work runs the exercise inside the generation
loop: generate, execute the reference solution against the real test suite in
the real image, and hand the stack trace back as the next turn. All four of
today's failures produce an unambiguous error message. A model that is shown
`NameError: name 'wraps' is not defined` fixes it immediately. A model that is
never shown anything ships it.

That is the general shape, and it is not really about exercises. A generator
without an execution gate is not a productivity tool, it is a queue of
plausible-looking work for somebody else to verify — and the verification is the
expensive part. If the artifact you are generating can be run, the thing that
generates it has to run it.
