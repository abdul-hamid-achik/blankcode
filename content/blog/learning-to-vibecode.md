---
title: Learning to vibecode is learning to review
description: The bottleneck is not prompting. It is deciding what to build, checking what came back, and knowing when to stop steering and read the code yourself.
date: '2026-08-06'
author: BlankCode
tags:
  - ai
  - practice
  - code-review
---

Watch someone who is good at building software with a model, and the surprising
thing is how little of it is prompting.

They talk to the model until the shape of the thing is clear. At some point the
conversation has enough in it that a specification can be written, and they let
the model write it — because by then the spec is a summary of a conversation
both parties were in, not a document one party has to invent. Sometimes they
hand over a few test cases in plain prose, not code: *it should reject an empty
list, and it should not mutate the input.*

Then the code comes back, and the actual work starts.

## Where it goes wrong is downstream of the prompt

People new to this ask how to write better prompts. It is the wrong question,
in the sense that it is the last question. The failures that cost a day are
almost never a badly worded request:

- The task was never pinned down, so the model produced something coherent that
  solved a slightly different problem — and coherent is exactly what makes it
  hard to notice.
- The code came back plausible and was accepted after a skim. Plausible is the
  default output. Skimming is calibrated for code written by a person who was
  also thinking about the edge cases.
- Something broke, and the next twenty messages were the model guessing and the
  human accepting guesses, with nobody establishing what was actually true.
- The model got told about the failure and not about the system, so it fixed the
  symptom in a way that would break something else.

Notice that the model is not the weak link in any of those. Each is a judgment
that stayed with the human, and got skipped.

## The skills, named

**Deciding what to build.** Vague in, coherent out. A model will not tell you
your requirements contradict each other; it will pick one reading and commit,
confidently, and you will not find out until you read the code closely enough to
see which reading it chose. Being specific about behaviour at the boundaries —
empty input, duplicates, failure — is most of what separates a spec that
produces the right thing from one that produces something.

**Reviewing code you did not write.** This is the load-bearing skill and it is
different from reviewing a colleague's work. A colleague's mistakes cluster
around what they did not know. A model's mistakes cluster around what was not
said: the invariant nobody stated, the case that was not in the examples, the
convention that lives in three other files. You are not looking for bad code.
You are looking for correct-looking code that answers a question you did not ask.

**Prompting under a budget.** Anyone can steer with unlimited turns. The skill
shows up when you have three: what do you say first, what do you check, and when
do you stop steering and read the code yourself. Most people over-invest in
turn one and then accept whatever arrives.

**Debugging with a model in the room.** The failure mode is a guessing loop —
try this, no, try this — where each attempt is plausible and nothing narrows.
The move is to make the model establish a fact before proposing a fix. What do
we know is true? What would distinguish these two explanations? A model is
genuinely good at generating hypotheses and genuinely bad at refusing to
generate them, so the discipline has to come from you.

**Giving it the right context.** Tools and connectors are, in practice, a
question about context: what does this thing need to see to answer correctly,
and what does handing it that cost? A model with the schema in front of it stops
inventing column names. A model with fifty files of irrelevant context gets
worse, not better.

## The moment you learn something

Ask people when they actually got better at this and the answer is consistent:
finishing something hard. Not reading about it. Getting to the bottom of a
problem that did not want to be gotten to the bottom of.

That is not a motivational point, it is a design constraint. You cannot learn
review by being told what good review is; you learn it by being handed code with
a real defect in it and finding out whether you catch it. You cannot learn to
prompt under a budget by reading about budgets.

Which means practice for this has to have the same shape as practice for
anything else: a concrete task, a real artifact, and an answer that is checkable
without you grading yourself.

## What that looks like as an exercise

The exercises we are building for this are all variations on the same idea —
make the judgment call, then find out.

You are given the output of a model — code that looks right and is not — and
asked to find the defect before you see the failing test. You are given a vague
request and asked to write the specification, which is then run against a set of
cases you were not shown. You are given a broken system and a fixed number of
turns. You are given a check to automate, and the tool you write is graded by
tests, including the ones that break the naive version.

None of these are about the model. They are about the part that stays yours: the
deciding, the checking, and the knowing when something plausible is wrong. That
part has always been the job. It is just that now it is nearly the whole job,
compressed into the space between asking and accepting.

The first of these are live in the [code review](/tracks) and
[tooling](/tracks) tracks. The rest are coming.

