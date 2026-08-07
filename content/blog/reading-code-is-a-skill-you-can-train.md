---
title: Reading code is a skill you can train on purpose
description: Reviewing a colleague and reviewing a model are different search problems. One rewards a model of the author, the other rewards a model of what you failed to say — and neither improves by resolving to read more carefully.
date: '2026-08-07'
author: BlankCode
tags:
  - code-review
  - ai
  - practice
---

Nobody schedules practice for reading code. People schedule practice for
writing it — a kata, a side project, a course — and then spend most of their
working day doing the other thing, on the assumption that reading is what
happens automatically while you are trying to do something else.

That assumption was survivable when you wrote most of the code you were
responsible for. It is not survivable now, and the argument for why review
became the load-bearing skill is
[already made](/blog/reviewing-code-you-did-not-write). This post is about the
next question: given that it is trainable, what specifically are you training?

## Two different search problems

Review is a search. You have a body of code that looks fine, a limited amount of
attention, and somewhere in there a defect that does not announce itself. Where
you look first is the entire skill, and it depends on who wrote it.

**Reviewing a colleague, mistakes cluster around what they did not know.** This
is a strong prior and you use it constantly, mostly without noticing. Someone who
has never operated this service under load will get the retry semantics wrong.
Someone who joined last month will not know that the parent record is written by
a different process. Someone strong who was rushing will have cut a corner they
can name, in the place they would name.

The prior is a person, and it is stable. Two months of reviewing the same
colleague and you know which three things to check first in their diffs, which
is why review inside a settled team gets fast — not because anyone reads
quicker, but because the search space keeps shrinking.

**Reviewing a model, mistakes cluster around what was not said.** There is no
career to reason about, no gaps in experience, no fatigue. What there is instead
is a boundary: everything that was in the context, and everything that was not.
The unstated invariant. The case that was not in the examples. The convention
that lives in three other files it never saw. The requirement you did not write
down because it was obvious to you.

So the prior is not a person, it is your own prompt. The highest-yield artifact
in a model-assisted review is the request you made — read it as a map of where
the bugs are, on the theory that the defects are sitting in its negative space.
Anything you specified is usually right. Anything you assumed is where to look.

## The difference that surprised me

There is a second asymmetry, and it is the one that actually breaks reviewing
habits.

A human's mistakes are correlated within a change. If someone misunderstood how
the cache invalidates, that misunderstanding shows up in five places, and once
you find one you find the rest. It runs the other way too: the first three
functions being thoughtful is real evidence about the fourth, because they came
from one person with one level of understanding on one afternoon. Sampling works.

A model's mistakes are not correlated like that. Today this repo generated five
exercises with a strong model. One of them is a genuinely well-constructed
decorator-factory exercise — correct nesting, sensible blanks, a test suite that
exercises the student's code rather than re-implementing it. Sitting beside it,
in the same batch, from the same model: a file with a duplicate identifier, one
importing a package that does not exist in the runner image, one whose tests
contradict its own reference solution, and one missing an import.

Competent design and trivial errors, in the same artifact, independent of each
other. Which means the sampling instinct — read the first screen, decide it is
good work, skim the rest — is not merely lazy here, it is *invalid*. The
evidence you gathered does not generalise the way your reviewing reflexes assume
it does. Every part has to be checked, and the only way to make that affordable
is to be much faster at checking each part.

That is the trainable thing.

## What training it looks like

Reading advice does not work, for the same reason reading a tutorial does not
restore a rusty skill. You need to make a call, and then find out.

Three drills that hold up:

**Name the defect before you see the failure.** Take code that looks finished
and is wrong, and commit to what is broken *before* running anything. The
commitment is what makes it practice rather than reading — a guess you never
stated cannot be wrong, so it teaches nothing. This is what the code review
exercises on the site are: the tests the code shipped with all pass, and you
have to find the defect anyway.

**Predict which test fails.** Slightly harder and worth more, because it forces
you to hold what the code actually does in your head rather than a feeling about
its quality.

**Review yesterday's diff — the one you accepted.** Take something you approved
while working with a model and read it cold, without the conversation. The
conversation is the thing that made it look right, and it is not in the file.
Everything you find is a lesson about your own accept threshold, which is the
number that decides your bug rate.

## The grading problem, and why it matters

If you build this as an exercise, there is a specific way it silently breaks.
A "find the bug" exercise whose starting code already passes its tests is
solvable by changing nothing. The learner submits, sees green, and learns
something false about their own judgment.

So the check is inverted: for every review exercise, the starter must **fail**,
verified by running it in the sandbox, and the build breaks if a starter passes.
That caught exercises here where a well-meaning edit had quietly repaired the
bug the learner was supposed to find. It is the same discipline as
[running your content before shipping it](/blog/run-your-content-before-you-ship-it),
pointed at the one exercise type where "it works" is the failure condition.

The code review exercises are on the [TypeScript](/tracks/typescript) and
[Python](/tracks/python) tracks. They are short, and the honest experience of
them is that you will submit confidently and be wrong, several times, about code
you had already decided was fine.

That is the mechanism. Nothing about reviewing improves by resolving to read
more carefully. It improves by being wrong about specific code, quickly, often
enough that your eye starts going to the right four places on its own.
