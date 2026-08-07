---
title: "Comprehensions Without Regret"
slug: "python-comprehensions-without-regret"
description: "When a comprehension makes code clearer and when it hides the logic, plus generator expressions, scoping rules, and the traps that come with laziness."
track: "python"
order: 5
difficulty: "intermediate"
tags: ["comprehensions", "generators", "readability", "itertools", "iterators"]
practice:
  concept: "data-structures"
  label: "Data structures"
---

A comprehension is not a shorter loop. It is a different claim: *this
expression produces a value*, rather than *these statements build one up*.

```python
# A loop: five lines, three of which are bookkeeping
squares = []
for n in numbers:
    squares.append(n * n)

# A comprehension: one expression, and the result is what it says
squares = [n * n for n in numbers]
```

The comprehension is better here for a specific reason, and it is not
brevity. `squares` is complete on the line that creates it — no window where
it exists half-built, no chance something between two lines mutates it
first. A list comprehension is also somewhat faster than the equivalent
`append` loop, since it skips a method lookup per iteration, but that's a
side effect worth having, not the reason to reach for one.

Everything below is about when the price of that one-line claim is too high.

## The One-Sentence Test

A comprehension should read as one sentence in English. If you can say it
out loud without backtracking, keep it.

```python
active = [u for u in users if u.is_active]
# "active users, for each user, if the user is active"
```

Now compare:

```python
result = [
    transform(u.profile.settings) if u.profile and u.profile.settings else default(u)
    for group in groups
    for u in group.members
    if u.is_active and not u.is_banned and u.created_at > cutoff
]
```

Everything there is legal and probably correct. But you cannot say it in a
sentence, you cannot put a breakpoint anywhere useful inside it, and when it
raises, the traceback points at the whole expression, not the line that
actually failed. This is the version a reader should get instead:

```python
result = []
for group in groups:
    for user in group.members:
        if not is_eligible(user, cutoff):
            continue
        result.append(render(user))
```

Longer, and each line does one thing you can step through.

## Filters, Conditionals, and Nested Loops

Two different `if`s live in a comprehension, and mixing them up is the most
common source of confusion.

```python
# Filter — comes after the for, decides whether an item is produced
evens = [n for n in numbers if n % 2 == 0]

# Conditional expression — comes before the for, decides which value
signs = ["even" if n % 2 == 0 else "odd" for n in numbers]
```

The filter changes the *length* of the result; the conditional expression
changes the *contents*. There is no `else` on a filter — write `if ... else`
after the `for` and Python rejects it outright.

Multiple `for` clauses run in the order you'd write them as nested loops —
left is outermost:

```python
pairs = [(x, y) for x in rows for y in cols]
# same as: for x in rows: for y in cols: pairs.append((x, y))

flat = [item for row in matrix for item in row]   # flattening reads well this way
```

Nesting a comprehension *inside* one reads poorly — the order flips, since
the inner brackets evaluate per item of the outer loop:

```python
transposed = [[row[i] for row in matrix] for i in range(len(matrix[0]))]
```

That's correct, and `zip(*matrix)` says the same thing in a form you can
check at a glance. Reach for the standard library before reaching for a
second level of brackets.

::code-blank{lang="python" href="/tracks/python/data-structures" label="practice data structures for real"}
---
code: |
  evens = [n for n in numbers ___blank_start___if___blank_end___ n % 2 == 0]
---
::

## What a Comprehension Cannot Do

Some limits are syntactic, and worth knowing before you fight them:

- **No statements.** No `try`/`except`, no `break`, no assignment. If an
  element might raise and you want to skip it, write a loop or a helper
  function that catches and returns a sentinel.
- **No accumulation across items.** Anything where element *n* depends on
  the result so far is a loop, `itertools.accumulate`, or `functools.reduce`.
- **Side effects don't belong in one.** A comprehension whose result you
  discard is a loop written to look like a value:

```python
[send_email(u) for u in users]   # builds a throwaway list of None, for the side effect

for user in users:               # says what it means
    send_email(user)
```

When the filter and the output both need the same expensive call, the
walrus operator computes it once instead of twice:

```python
records = [parse(line) for line in lines if parse(line) is not None]         # calls parse() twice
records = [record for line in lines if (record := parse(line)) is not None]  # once
```

That's one of the few places `:=` clearly earns its keep. It scales badly —
two of them in one comprehension is a loop wearing a disguise.

## Dict and Set Comprehensions

Same syntax, different brackets.

```python
by_id = {u.id: u for u in users}
domains = {email.split("@")[1] for email in emails}
```

`{}` alone is an empty dict, not an empty set — `set()` is the only spelling
for one. A dict comprehension built from a source with duplicate keys keeps
the **last** occurrence and drops the rest, silently:

```python
by_email = {u.email: u for u in users}   # two users, one email -> one survives
```

If that's not what you want, group instead of collapsing:

```python
from collections import defaultdict
by_email = defaultdict(list)
for user in users:
    by_email[user.email].append(user)
```

::code-blank{lang="python" href="/tracks/python/data-structures" label="practice data structures for real"}
---
code: |
  empty_set = ___blank_start___set___blank_end___()
---
::

## Generator Expressions

Swap the brackets for parentheses and nothing is built — you get an
iterator that produces values as they're requested.

```python
squares = (n * n for n in numbers)   # nothing computed yet
total = sum(squares)                 # computed now, one at a time
```

Three reasons to prefer one. **Memory** — `sum([n * n for n in
range(10_000_000)])` builds ten million integers before summing them; the
generator holds one at a time. **Short-circuiting** — `any` and `all` stop
at the first decisive element, so a generator inside them stops producing,
while a list comprehension gets fully built regardless. **Streaming** — a
generator over an open file reads line by line, so the file never has to fit
in memory:

```python
with open("access.log") as f:
    errors = (line for line in f if " 500 " in line)
```

Two traps come with the laziness. A generator is consumed **once** — after
you iterate it, it's empty, and it doesn't tell you that, it just yields
nothing next time. And the loop variable is read **late**: only the first
iterable is evaluated immediately, so state that changes between creation
and consumption changes the result:

```python
threshold = 10
matches = (n for n in numbers if n > threshold)
threshold = 100
print(list(matches))   # filtered by 100, not 10
```

::code-blank{lang="python" href="/tracks/python/data-structures" label="practice data structures for real"}
---
code: |
  results = (expensive(x) for x in items)
  first_batch = ___blank_start___list___blank_end___(results)
---
::

## Scope

A comprehension has its own scope in Python 3 — the loop variable doesn't
leak into the surrounding one:

```python
n = "unchanged"
squares = [n * n for n in range(5)]
print(n)   # "unchanged"
```

The exception is class bodies. A comprehension inside one can't see the
class's other attributes — its scope excludes the class namespace, except
for the leftmost iterable, which is still evaluated where the class body can
see itself:

```python
class Config:
    defaults = [1, 2, 3]
    doubled = [d * 2 for d in defaults]        # works — leftmost iterable
    scaled = [d * factor for d in defaults]    # NameError, even if factor is right above it
```

This surprises people who already know comprehensions have their own scope
— a class body is the one enclosing scope that doesn't behave like the rest.

## Where This Bites

**A comprehension that needs a comment to explain it should be a loop
instead.** Past the one-sentence test you lose breakpoints and useful
tracebacks, and both cost more than the extra lines a loop takes.

**Side effects hiding inside a comprehension build a throwaway list of
`None` while doing real work.** If you're discarding the result, write the
`for` loop — it says what's actually happening.

**A generator is single-use, and it fails by going quiet, not by raising.**
The second pass over an exhausted generator yields nothing rather than an
error, so a function iterated twice looks broken with nothing to point at.
Call `list()` on it the moment you need the values more than once.

**Stacking two walrus assignments in one comprehension is a loop wearing a
disguise.** One `:=` for a value used twice is a legitimate win; two is a
sign the comprehension should be a loop with named intermediate variables.
