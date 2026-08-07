---
title: Spaced repetition for code, concretely
description: The scheduler is SM-2, the intervals are 1, 3, 8, 20, 50, 125 days, and the pass/fail that drives it comes from running your code rather than from you rating yourself.
date: '2026-08-07'
author: BlankCode
tags:
  - spaced-repetition
  - learning
  - practice
---

Spaced repetition gets described in the abstract a lot: review things just
before you forget them, intervals expand, memory consolidates. That is all true
and none of it tells you what the system does when you get an exercise wrong on
a Tuesday.

So here is the actual mechanism, with the actual numbers.

## Three numbers per exercise

Every exercise you have attempted carries a row with three values: an
**interval** in days, a **repetition count**, and an **ease factor** that starts
at 2.5. A fourth column, `nextReviewAt`, is what the due queue reads.

When you pass an exercise, the scheduler runs:

- repetition 0 → interval **1 day**
- repetition 1 → interval **3 days**
- after that → interval **× ease factor**, rounded

With ease at its default 2.5 and nothing going wrong, the sequence an exercise
walks through is **1, 3, 8, 20, 50, 125 days**. Six correct answers spread over
about seven months, and then it is essentially out of your way.

When you fail, all of that collapses. The interval goes back to 1 day, the
repetition count resets to zero, and the ease factor drops by 0.2 — to 2.3,
floored at 1.3 no matter how many times you miss it.

That ease drop is the part worth understanding, because it is what makes the
system adapt rather than just repeat. At 2.5 the ladder is 1, 3, 8, 20, 50. At
2.3 the same ladder is 1, 3, 7, 16, 37. At the 1.3 floor it is 1, 3, 4, 5, 7 —
an exercise you keep missing stops stretching out at all, and comes back roughly
weekly until something changes.

Nobody has to decide any of this. You are bad at Go's `errors.As` and fine with
Python dict comprehensions, so within a month you are seeing `errors.As`
constantly and the comprehensions almost never. The schedule found that, not
you.

## The rating is optional; the verdict is not

Most flashcard software asks you to grade yourself: did you know that? Easy,
good, hard, again. This is where the *fluency illusion* gets its foothold. You
look at the back of the card, you recognise it, recognition feels like
knowledge, and you press "good" on something you could not have produced.

Here the primary signal is not a self-report. You fill in the blanks, the code
runs against the exercise's real test suite, and the tests either pass or they
do not. That boolean is what drives the scheduler — a pass records quality 4, a
failure records quality 1, and the interval math follows.

You *can* rate your recall afterwards, and it adjusts the interval: "hard"
multiplies it by 0.8 and takes 0.14 off the ease, "easy" multiplies by 1.3 and
adds 0.1. That is a useful refinement, and it is deliberately only a refinement.
The thing that decides whether an exercise comes back tomorrow or in fifty days
is a machine that ran your code, and it cannot be talked into anything.

## Why recall, and why for code especially

The general argument is well established: being tested on material beats
re-studying it, and the advantage grows the longer you wait to measure. Reading
is recognition, producing is recall, and only the second one strengthens the
memory.

Code makes the distinction unusually stark, because of what actually decays.
Concepts are sticky — if you once understood why a mutex is needed you will
still understand it years later. What you lose is **production fluency**: the
exact form of a lifetime annotation, the argument order of a `context` call, the
name of the `itertools` function you used for years.

Now notice what re-reading a tutorial does to that. Every code sample on the
page is the answer, printed. You cannot fail to produce something that is
sitting in front of you, so the one capability that has actually decayed is the
one activity that never exercises it. Re-reading trains the part that did not
break.

## Why the review has to be typing code

There is an obvious cheaper design: show the code, blank a token, offer four
options, let the learner pick. Multiple choice is easy to grade, easy to build,
and works fine on a phone.

It also trains a task that does not exist. Choosing between four candidates you
have been shown is a discrimination problem. Writing code is a production
problem, and the gap between them is exactly the gap you are trying to close. A
learner who can reliably pick `errors.As` from a list of four still stalls in
front of an empty editor, because "which of these is right" and "what goes here"
are different questions and only one of them has ever been asked at work.

Multiple choice exists in learning software for an infrastructural reason:
free-text answers used to be hard to grade. When your grader is a sandbox
running a real test suite, that constraint is gone, and there is no reason left
to accept a weaker form of retrieval. Typing the token is both the harder
retrieval and the cheaper one to check.

The blanks matter for the same reason in the other direction. A completely empty
editor is not a harder version of retrieval — for a rusty skill it is often not a
retrieval attempt at all, just a failure to start. Filling in blanks keeps the
structure visible so the attempt is possible, and removes precisely the tokens
that carry the knowledge. Each blank is one clean success or one clean miss.

## What the daily loop looks like

The due queue is ordered by `nextReviewAt` ascending — oldest debt first, no
gallery of cards, one click from the top item. Everything you have passed is
scheduled; everything you have failed is scheduled sooner.

Two practical notes from running it:

**Fifteen minutes most days beats three hours on Saturday.** The forgetting
curve rewards frequency, and a session that ends before you are tired is a
session you repeat tomorrow.

**Expect the first two weeks to be unpleasant.** The queue is dense and you will
miss a lot, because the system is finding your gaps and it has not yet spread
anything out. By week three the intervals of everything you actually know have
stretched past a month, and the daily list is short and mostly things you are
genuinely bad at. That is the system working, not the system being lenient.

## Where this is honest about its limits

SM-2 is from 1987 and it is not the state of the art. Newer schedulers model
memory more carefully and would probably fit the intervals better. SM-2 is here
because its behaviour is legible — three numbers, two branches, and you can
predict what any answer will do to your queue, which is what let this post state
the ladder as 1, 3, 8, 20, 50, 125 rather than as a curve.

The interesting part was never the algorithm anyway. Any of them will space
things out. The part that changes the outcome is where the quality signal comes
from, and here it comes from executing your code rather than from asking you how
that felt.

The tracks are [here](/tracks). Anything you pass enters the schedule, and it
will come back.
