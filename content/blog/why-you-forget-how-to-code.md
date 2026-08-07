---
title: Why you forget how to code, and what actually brings it back
description: Skills you built over years fade in months once you stop using them. The fix is not re-reading tutorials — it is being asked to recall the thing right before you would have forgotten it.
date: '2026-08-06'
author: BlankCode
tags:
  - learning
  - spaced-repetition
  - practice
---

You spent years getting good at something. Then you changed jobs, or moved into
management, or the project ended, and eighteen months later you open an editor
and cannot remember how to write the thing you used to write without thinking.

This is not a character flaw and it is not unusual. It is the ordinary behaviour
of memory, and it has a well-studied shape.

## Forgetting is a curve, not a cliff

Hermann Ebbinghaus measured it in the 1880s by memorising nonsense syllables and
testing himself at intervals. What he found is that retention drops steeply at
first and then flattens: most of what you lose, you lose early. The practical
consequence is that the gap between learning something and next using it matters
enormously, and the gap after that matters less, and the one after that less
still.

Programming knowledge decays unevenly along this curve. Three things fade at
very different rates:

- **Concepts** are sticky. If you once understood why a mutex is needed, you
  will probably still understand it in five years.
- **Syntax** goes quickly. The exact form of a Rust lifetime annotation, the
  argument order of a Go `context` call, the name of the Python `itertools`
  function you always used — these are arbitrary, and arbitrary things need
  repetition.
- **Fluency** — the ability to produce working code without stopping to look
  things up — goes fastest of all, because it depends on the syntax layer being
  effortless.

Most people notice the third one first. You still know what to do; you have just
lost the ability to do it without friction. That feels like having lost
everything, which is why it is so discouraging, and why the usual response is
the wrong one.

## Re-reading feels like learning and mostly is not

The instinct is to go back to documentation, or a course, or a tutorial you
liked. This is pleasant and it produces a strong feeling of understanding. The
feeling is largely an illusion, and it has a name: the *fluency illusion*. Text
you have read before is easy to read again, and your brain interprets that ease
as knowledge.

The distinction that matters is between **recognition** and **recall**. Reading
a code sample and thinking "yes, of course" is recognition. Being handed a blank
line and having to produce the right thing is recall. Only the second one
strengthens the memory, and it is measurably stronger — this is the *testing
effect*, one of the most replicated findings in the learning literature. Being
tested on material beats re-studying it, and the gap widens the longer you wait
to measure.

The catch is that recall is uncomfortable. It involves being wrong, repeatedly,
about things you feel you should know. Re-reading never does that, which is
exactly why people prefer it.

## Retrieval, spaced along the curve

Put the two ideas together and you get the approach that actually works:
practise by retrieving, and schedule the retrievals to land just before you
would have forgotten.

That scheduling part is what spaced repetition systems do. The scheduler used
here is SM-2, the algorithm behind most flashcard software. It keeps two numbers
per item: an interval, and an ease factor that reflects how well you have done
on it. Get something right and the interval multiplies — one day, then three,
then a week, then a month. Get it wrong and the interval collapses back to the
beginning, and the ease factor drops so that this item comes around more often
than its neighbours from now on.

The effect over a few months is that your practice concentrates itself on your
weak spots without you having to decide what those are. You are bad at Rust
lifetimes and fine with Python comprehensions, so you see lifetimes constantly
and comprehensions rarely. Nobody had to notice this and act on it. The schedule
noticed.

## Why the blanks, specifically

There is a version of retrieval practice that is too easy and a version that is
too hard, and for a rusty skill both are wasted time.

Multiple choice is too easy: it is recognition wearing a costume. You do not
produce anything, and picking the right option out of four is a different task
from writing it.

A blank editor is too hard, at first. Being asked to implement a work-stealing
queue from nothing when you have not written concurrent code in two years does
not test your memory — it just fails, and failing to start is not a retrieval
attempt. You need enough scaffolding that the attempt is possible.

Filling in blanks sits between them. The structure is given, so you know what
you are building and where you are in it. The parts that are removed are the
parts that carry the knowledge: the type annotation, the lifetime, the
synchronisation primitive, the base case. You have to produce those from memory,
one at a time, and each one is a real retrieval attempt that either succeeds or
fails cleanly.

The other thing this buys you is granularity. When an exercise fails, it fails
at a specific blank, so the thing that gets rescheduled is the thing you
actually got wrong.

## What this looks like in practice

Fifteen minutes, most days, beats three hours on a Saturday. The curve rewards
frequency over volume, and a session that ends before you are tired is a session
you will repeat tomorrow.

Expect to be wrong a lot at the start, particularly in the languages you are
rustiest in — that is the system finding your gaps, which is the entire point.
The error rate falls fast, and the intervals stretch out, and after a couple of
months the daily queue is short because most of what you knew has come back and
is not due again for a while.

That is the goal, incidentally. Not to practise forever, but to get back to the
point where you open an editor and your hands know what to do.
