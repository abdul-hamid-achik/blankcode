---
title: How to write a skill that holds up on the case you did not think of
description: Turning a procedure you know into instructions an agent follows correctly is a testable engineering problem, not a writing exercise. The test is the case you held back.
date: '2026-08-06'
author: BlankCode
tags:
  - ai
  - tooling
  - process
---

There is a specific moment worth paying attention to: you explain the same
procedure to a model for the fourth time. How you deploy. What "done" means
here. Which three things always break.

That repetition is the signal. The knowledge exists, you clearly have it, and it
is being retyped from memory every time — slightly differently, and slightly
worse when you are in a hurry. Writing it down as a skill is the same move as
replacing a manual check with a rule: pay once, hold the line afterwards.

The part people get wrong is what kind of artifact it is. A skill reads like
documentation, so it gets written like documentation — and documentation is
graded by whether a human who already understands the subject nods along. A
skill is graded by whether an agent that does *not* understand the subject
produces the right result. Those are different bars, and the first one is easy
to clear while completely failing the second.

## The failure mode: it works on your examples

You write the skill. You try it on the case you had in mind. It works. You ship
it.

Then it meets a case you did not have in mind, and it does something confidently
wrong — because the instructions covered the situation you were picturing while
writing them, and said nothing about this one. The agent does not stop at the
edge of your knowledge. It extrapolates, plausibly, and the result looks like it
followed the procedure.

This is the same trap as a test suite written after the code, by the person who
wrote the code. It passes because it was built from the same assumptions.

## Hold cases back

The fix is mechanical: before you write a single line, collect the cases. Then
put half of them away and do not look at them.

Write the skill against the half you kept. Get it working. Then run it against
the half you held back — and every failure there is real information, because
those cases could not have leaked into the wording.

This is the difference between a skill you believe in and a skill you have
tested, and it is worth being strict about, because the failures on held-out
cases are consistently the *interesting* ones. The kept cases teach you to
describe the happy path. The held-back cases teach you where your procedure was
never actually a procedure — where you were relying on judgment you never wrote
down, because you did not know you had it.

## What separates a good skill from a summary

A few patterns show up repeatedly in skills that survive contact with real
cases.

**Say what to do, not what is true.** "The build cache can cause stale
dependencies" is a fact. "If a dependency fix does not take effect, invalidate
the build cache and redeploy" is an instruction. Facts get acknowledged;
instructions get followed.

**Name the failure and the response together.** Most of the value in a hard-won
procedure is not the steps — it is the four ways you have seen it go wrong and
what you did each time. A skill that lists only the happy path throws away the
expensive half of what you know.

**Bound it.** A skill that covers everything gets loaded for everything and
consulted for nothing. The description is not a title; it is the thing that
decides whether the skill is used at the right moment. Write it as a condition:
*when someone is doing X and needs Y.*

**Prefer a check to a warning.** "Be careful not to commit secrets" is a
sentence. A step that greps for them is a check. Wherever a skill can call
something that verifies instead of asking someone to be careful, it should.

**Include the case that broke the first version.** Every skill has one — the
input that made the obvious wording produce the wrong result. That case belongs
in the skill permanently, because it is the one piece of the document that
cannot be re-derived from being smart about the subject.

## The general shape

This is the same loop as the rest of engineering, which is the point:

1. Notice you are repeating yourself.
2. Collect real cases. Hold half back.
3. Write the procedure against the visible half.
4. Run it against the held-back half.
5. Fix what fails, and keep the failures as cases.

The reason to be formal about it is that the alternative feels identical from
the inside. A skill that works on the cases you thought of and a skill that
works are the same document until something tests them apart. Only one of them
is doing the job you wrote it for.

And the compounding is real, in the same way it is for a lint rule. A procedure
in your head is available when you remember it and degrades under pressure. A
procedure written down and tested against cases you deliberately did not look at
is available every time, to everyone, including the version of you that is
tired and just wants this deployed.
