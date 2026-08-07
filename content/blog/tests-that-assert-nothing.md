---
title: We shipped 91 exercises. Two of them graded everyone correct.
description: A test that calls a function and never checks the result passes forever. Reviewing for that by hand does not scale, and it did not work. A forty-millisecond rule found both.
date: '2026-08-06'
author: BlankCode
tags:
  - tooling
  - testing
  - code-review
---

Every exercise on this site is graded by running its real test suite against
your answer. That design has an obvious failure mode, and we walked into it.

Two exercises contained a test that looked like this:

```typescript
it('parses the header', () => {
  parseHeader('Content-Type: text/html')
})
```

It calls the function. It ignores what came back. It passes as long as the code
compiles — which means it passes for a correct implementation, for a wrong one,
and for one that returns `undefined` and always did. An exercise resting on a
test like that grades everybody correct and tells them nothing.

Both had been read by a human before they shipped. Reading is how you miss this.
The test is syntactically fine, it is short, it sits between two real tests, and
your eye supplies the assertion that is not there because your eye knows what
the test is *for*.

## The check you keep meaning to do

The honest response to finding those two was not "read more carefully next
time". It was: this is the third thing in a month that I have promised to check
by hand every time.

That promise is worth almost nothing. Checks you perform by remembering to
perform them decay in exactly the situation where they matter most — when you
are tired, when the change is small, when you have done forty of these already
and this one is obviously fine.

So the rule became a rule. About thirty lines: walk each file, find every
`it(...)` and `test(...)`, take its body by brace depth rather than by regex,
and report the ones that never mention `expect(`, `assert(` or `.should`.

It runs over the whole corpus in about forty milliseconds. It found both. It
has run on every exercise written since.

## Brace depth, not a regex

The first version tried to grab the test body with a regular expression, and it
was wrong immediately, because a test body contains braces:

```typescript
it('groups by parent', () => {
  const grouped = groupBy(rows, (row) => ({ key: row.parent }))
  expect(grouped.size).toBe(2)
})
```

Any pattern that looks for the closing brace textually finds the wrong one the
moment a test contains an object literal, a nested arrow function, or an `if`.
Counting depth is barely more code and is right for the same reason a parser is
right: it models the thing instead of matching its shape.

This is the usual shape of a small tool. The naive version is fifteen minutes
and is subtly wrong on real input. The correct version is twenty-five minutes.
The difference is one insight, and you only get it by running the naive version
against real input and watching it lie to you.

## Why a tool and not a habit

There is a specific class of defect a tool catches and a person structurally
cannot:

- **It is invisible at the level you review at.** Nobody reviews one test in
  isolation; you review a file, and one hollow test in a healthy file reads as
  healthy.
- **It has no symptom.** A test that asserts nothing does not fail. It does not
  warn. Coverage counts it as covered. The only signal is its absence of
  signal.
- **It is boring.** Anything checked by attention gets checked worst on the
  fiftieth file, which is exactly where corpus-wide problems live.

A second one from the same week: the content importer upserts on
`(parent, slug)`. Two files claiming the same slug under the same parent is not
an error at any layer — both parse, both import, and the second silently
replaces the first. The exercise you spent an hour on is simply gone, and the
only symptom is a count that should have gone up and did not.

No amount of care while editing one file catches that, because the collision is
not in any file. It is between two of them. A tool that looks across the corpus
is not a more disciplined version of reviewing; it is the only thing that can
see it at all.

## The rule of thumb

If you have checked something by hand more than twice, the third time should
build the check.

The bar is lower than people think. Both of these tools are under fifty lines.
Neither needed a parser, a config format, or a plugin system. What they needed
was for someone to notice that the check was already happening, badly, in
someone's head — and to move it somewhere it would happen the same way every
time.

The compounding is the point. A habit is a tax you pay per file forever, and it
degrades. A rule is paid once and then holds the line for every file anyone
writes afterwards, including the ones written at midnight by someone who has
never heard of the bug that caused it.

Both of these checks are exercises on this site now, in the tooling track:
[find the tests that assert nothing](/tracks/typescript) and
[find the records one import overwrites](/tracks/python). You write the tool,
and the tool is graded by tests — including the cases that made the first
version wrong.
