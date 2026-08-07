---
title: Why your practice site should run your code
description: Similarity scoring and keyword matching grade the shape of an answer. A test suite grades the behaviour, accepts any correct solution, and hands back a stack trace — which is the part that teaches.
date: '2026-08-07'
author: BlankCode
tags:
  - testing
  - infrastructure
  - quality
---

There are four ways a practice site can decide whether your answer is right,
and only one of them involves your code ever running.

**Keyword or regex matching.** Does the answer contain `await`? Does it match
`/for\s*\(/`? Cheap, instant, and grades vocabulary rather than behaviour. Code
that contains all the right words and does the wrong thing passes; so does code
that does nothing at all.

**Similarity to a reference solution.** Diff the submission against the answer
and threshold it. This one is worse than it sounds, because it punishes exactly
the learners you want. A student who writes a correct solution with different
variable names, or an early return instead of an else, or `enumerate` instead of
an index counter, is told they are wrong for being different.

**AST comparison.** More sophisticated, same failure. You are still asserting
that there is one shape of correct answer, just at a level where you feel
better about it.

**A model judging the answer.** Flexible, and it has the property that makes
everything else on this list dangerous: it is confidently wrong sometimes, and
you cannot tell which times.

All four share a defect that matters more than any of their individual
weaknesses. When they are wrong, they are wrong about a *correct* answer — and a
learner who submits working code and is told it is incorrect does not conclude
that the grader is broken. They conclude they misunderstood something, and they
go looking for a mistake that is not there. That is the most expensive minute a
teaching product can sell.

## What running it changes

Here every submission is compiled and executed against the exercise's real test
suite, in the same image the exercise was verified in.

The first consequence is that any correct answer passes. There is no canonical
form. Use a comprehension or a loop, name the variable `acc` or `total`, return
early or don't — the tests assert behaviour, and behaviour is the thing being
taught.

The second consequence is the one people underrate: **you get the real error.**

```
TypeError: Cannot read properties of undefined (reading 'name')
    at formatUser (solution.ts:12:22)
    at Object.<anonymous> (solution.test.ts:8:18)
```

That is not a grade. It is a fact about your program, at a line number, with a
call path attached. It tells you a value you expected to exist did not, names
where you touched it, and names who called you. Reading it is the same skill you
will use tomorrow at work — arguably it *is* the skill, because most debugging
is the ability to take a stack trace seriously instead of re-reading the
function hoping to spot the bug.

A similarity score cannot produce that. The best it can say is "not close
enough", which is a fact about the grader, not about your code.

## What it costs

An honest version of this argument has to include the bill, because a grader
that is a regular expression has no infrastructure at all and this one has
quite a lot.

Every submission gets a sandbox of its own, which is destroyed when the run
ends. Locally that is a Docker container with the flags turned all the way down
— no network, read-only root, all capabilities dropped, a pid limit, memory and
CPU caps. In production it is a Firecracker microVM per submission, because the
threat model of running strangers' code deserves a boundary that is not the host
kernel; that trade-off has [its own
post](/blog/running-untrusted-code-containers-vs-microvms) and is not repeated
here.

The run takes between two and twelve seconds end to end depending on the
language — create the sandbox, write the files, compile, run the tests, parse
the output. Python is at the fast end, Rust at the slow one. That is short
enough to happen inside the request that created the submission, which is why
there is no queue and no worker process, and it is also long enough that you
feel it. A regex would have answered in a millisecond and told you less.

Each language needs an image with its toolchain, its test runner, and warm build
caches already in it, because installing a compiler per submission is where the
latency actually lives. Those snapshots expire after thirty days unused, which
silently breaks execution for that language, so a weekly cron boots one sandbox
per language purely to reset the clock. That cron job is the real price of this
design, and it is worth it.

## The grader has to observe the thing you are teaching

Running the code is necessary and not sufficient. The test has to be able to
*see* what the exercise claims to teach, and there is a family of exercises
where it silently cannot.

TypeScript type annotations are erased before the tests run. So a blank that
asks for `Record<string, number>` is, at runtime, indistinguishable from a blank
filled with anything at all — the exercise would grade a wrong answer as correct,
forever, and look perfect while doing it. The fix is that the TypeScript executor
compiles the solution and the test together as one module before running them, so
a type blank fails at compile time. Languages without that backstop have a rule
instead: blank runtime behaviour, not annotations.

There is a second grader in the product, and it is the weaker one. Per-blank
feedback — the "this blank is wrong" hint, as distinct from the verdict — is an
exact trimmed string compare. It cannot know that `'x'` and `"x"` are the same
answer. This is why the authoring rules say a blank's answer must be the only
reasonable string, and why an exercise gets restructured rather than shipped
when an equivalent answer exists. Mentioning this is the point: the moment any
part of your grading is shape-matching rather than execution, you inherit all
the problems from the top of this post, in that part.

## The same argument, pointed at the content

If you take "execute it" seriously as a grading principle, it applies one level
up too. An exercise is a promise that an answer exists which makes these tests
pass, and the only way to keep that promise is to run the reference solution in
the same sandbox the learner will use. Doing that here found
[eleven exercises nobody could have solved](/blog/run-your-content-before-you-ship-it),
every one of which had been read by a human and looked fine.

Reading tells you whether something is coherent. Running tells you whether it is
true. A practice site is in the business of the second one, on both sides of the
submit button.
