---
title: 'Reviewing code you did not write: the skill AI made mandatory'
description: Generating code is now cheap and reviewing it is not. The failure mode is not bad code that looks bad — it is wrong code that looks right, and reads fluently, and passes the tests you thought to write.
date: '2026-08-06'
author: BlankCode
tags:
  - ai
  - code-review
  - practice
---

There is a skill that used to be optional and now is not.

When you wrote all your own code, reviewing it was a formality — you already
knew what it did, because you had just decided. Now a model produces two hundred
lines in four seconds, and the only thing standing between those lines and your
production database is whether you actually read them.

Most people do not. They read them the way you read a contract you have already
decided to sign.

## The failure mode is fluency, not garbage

The intuition people carry in is that bad AI code will look bad. It does not.
Models are extremely good at producing code that reads well: sensible names,
plausible structure, a comment in the right place. That is precisely what makes
it dangerous. Your reviewing instinct was trained on human code, where sloppy
thinking usually shows as sloppy prose, and it is calibrated for a correlation
that no longer holds.

The four things that actually go wrong, roughly in order of how often they slip
through:

**The invented API.** A method that should exist, on a library that does have
methods like it, with exactly the signature you would have designed. It does not
exist. This one is easy to catch — the code fails immediately — but it teaches
the wrong lesson, because people conclude "the compiler will catch it" and stop
looking for the other three.

**The missing edge case.** The happy path is right. Empty input, a single
element, a duplicate key, a value exactly at the boundary — one of them is not
handled, and nothing in the code looks incomplete, because the code that is
there is correct. Absence has no syntax.

**The wrong concurrency semantics.** `await` inside a loop that should have been
`Promise.all`, a lock taken in the wrong order, a read that assumes it happens
before a write. The code is correct under the interleaving you imagined while
reading it.

**The plausible constant.** A retry count, a timeout, a page size, a rounding
mode. There is no way to see from the code that 3 was picked because 3 sounds
reasonable rather than because someone measured.

Only the first of those looks wrong.

## Tests are the wrong safety net, on their own

The reflex answer is "that is what tests are for." It is half an answer.

The problem is that when you ask the same model for the code and the tests, the
tests encode the same misunderstanding. If it did not think about the empty
array while writing the function, it will not think about it while writing the
test. You get green, and green feels like evidence.

The tests that would have caught the bug are the ones nobody thought to write —
which is the same statement as "the bug exists."

What actually works is separating who specifies from who implements. Write the
cases first, in prose, before any code exists. Or take the cases from somewhere
that was not in the conversation: the bug tracker, the spec, a colleague, the
production logs. The value comes from the independence, not from the format.

## Read it in a different order than it was written

Reading code top to bottom is reading it in the order designed to make it look
reasonable. It is the order the author — human or not — used to convince
themselves.

Three habits that break the spell, all cheap:

**Start from the edges.** Before reading the body, ask what the input space is
and what happens at each boundary of it. Then go find where each boundary is
handled. Missing handling is far more visible when you go looking for a specific
thing than when you wait to notice its absence.

**Read the names as claims, not labels.** A function called
`validateAndNormalize` is asserting two things. Check both. Names are the part
of generated code most likely to be aspirational, because they were produced
from the intent rather than from the implementation.

**Ask what would have to be true.** For each non-obvious line: what does this
assume? That the list is sorted, that the connection is still open, that this
runs before that. Then check whether anything guarantees it. Most real bugs are
an assumption that nothing enforces.

## The uncomfortable part

Reviewing well is slower than writing. That is the actual trade, and pretending
otherwise is how teams end up shipping code nobody has read.

The way out is not to review faster. It is to be good enough at it that the
reading is dense rather than long — you look at the four places where this class
of code usually goes wrong instead of skimming all two hundred lines evenly. That
is a trainable skill, and it trains the same way every other one does: by being
wrong about specific cases, repeatedly, with fast feedback about which specific
thing you missed.

Which is a strange thing to notice. The advice for keeping up with AI-generated
code turns out to be the same as the advice for keeping your own skills sharp:
practise retrieving, get told immediately when you are wrong, and let the misses
decide what you see next.
