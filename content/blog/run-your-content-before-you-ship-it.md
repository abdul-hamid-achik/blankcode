---
title: Eleven of our exercises were impossible. We only found out by running them.
description: Every exercise had been read and looked fine. Executing the reference solution against the real test suite found eleven that nobody could have solved, including three the author was sure about.
date: '2026-08-06'
author: BlankCode
tags:
  - testing
  - quality
  - tooling
---

An exercise on this site is a promise: there exists an answer that makes these
tests pass. If that promise is false, the learner does not discover a bug. They
discover that they are stupid, and they leave.

So we wrote a script that keeps the promise honest. For every exercise, take the
reference solution, run it in the sandbox against the real test suite, and
require it to pass. Ninety-six exercises. Eleven failed.

All eleven had been read. Several had been read twice.

## What "impossible" actually looked like

None of the eleven were obviously broken. Every one had a plausible-looking
task, a plausible-looking test suite, and no visible defect.

**Two depended on packages that were not there.** One imported
`pytest-asyncio`, one used `sqlite3`. Both are the kind of thing you assume is
present because it is present everywhere you have ever worked. The test suite
did not fail with a helpful message about a missing dependency; it failed
during collection, which reads like the learner's code being wrong.

**One tested a number that does not overflow.** The exercise asked the learner
to handle floating-point overflow, and the test divided 1 by 1e-38. That is
about 1e38, comfortably inside an `f64`. The test asserted an overflow that
physically could not occur. It had been reviewed by someone who knew the
concept well — which is exactly why they read the intent and not the arithmetic.

**One asserted a word count of 7 where the text contained 6 words.** The string
had escaped newlines in it, and whether you see six words or seven depends on
whether you read `\n` as a character or a line break. The author read it one
way. Python read it the other.

**One contradicted itself three separate times.** The description asked for one
behaviour, the type signature required a second, and two of the tests demanded a
third. Any two could be satisfied. Not all three.

**Four were testing environment quirks, not the skill.** Two React exercises
combined `waitFor` with fake timers, which deadlocks: `waitFor` polls on a timer
that the test has frozen. Two Vue ones needed to set `event.target`, which Vue
Test Utils will not let you do. In every case the learner would have written
correct code and watched it fail.

## Reviewing content is not the same as running it

The failure mode is specific and worth naming. When you review an exercise you
are checking whether it *makes sense*. You read the task, you read the tests,
you confirm they describe the same thing, and they do. What you cannot do by
reading is execute it — and every one of those eleven failures lived in the gap
between "describes a coherent task" and "a machine agrees".

Content is code. It has dependencies, an environment, and a runtime. We do not
ship code because it reads well, and there is no reason content that *executes*
should get an exemption.

## Two things that made the check trustworthy

**Reference solutions had to be real.** The check is only as good as the
solution it runs, so writing a reference solution is now part of writing an
exercise — not documentation added afterwards, but the artifact that proves the
task is possible. Thirty-one exercises did not have one. Writing them found
problems before the script even ran.

**For review exercises, the starter must fail.** A "find the bug" exercise where
the starting code already passes is a different kind of broken: it is solvable,
trivially, by changing nothing. So for those the script runs the starter too and
fails the build if it passes. That caught exercises where a well-meaning edit
had quietly fixed the bug the learner was supposed to find.

There is one more piece of paranoia in there. The sandbox occasionally flakes —
a cold start, a network hiccup — and a check that cries wolf gets switched off.
So a failure is retried once, and only a repeat failure is reported. A flaky
gate is worse than no gate, because it teaches everyone to ignore it.

## The near-miss

While verifying something unrelated the same week, a check returned an empty
result and was very nearly recorded as a pass. Empty was the *expected* shape.
It was also what a broken query returns.

The distinction between "found nothing" and "did not look" is invisible in the
output and total in meaning. If a verification can return the same value for
success and for failure-to-run, it is not a verification yet. Make it print
what it examined, not just what it concluded.

## The gate

The script runs in CI now. Ninety-six exercises, ninety-six passing reference
solutions, every review exercise's starter confirmed to fail. An exercise that
cannot be solved cannot ship.

The general version of this is smaller than it sounds: **if your content has a
correct answer, execute the correct answer in the same place your users will.**
Not a staging approximation. The same sandbox, the same image, the same
dependencies. Everything the eleven had in common was that they were fine in a
world slightly different from the one they actually ran in.
