---
title: "Comprehensions Without Regret"
slug: "python-comprehensions-without-regret"
description: "When a comprehension makes code clearer and when it hides the logic, plus generator expressions, scoping rules, and the traps that come with laziness."
track: "python"
order: 5
difficulty: "intermediate"
tags: ["comprehensions", "generators", "readability", "itertools", "iterators"]
---

# Comprehensions Without Regret

A comprehension is not a shorter loop. It is a different claim about the code:
*this expression produces a value*, rather than *these statements build one up*.

```python
# A loop: five lines, three of which are bookkeeping
squares = []
for n in numbers:
    squares.append(n * n)

# A comprehension: one expression, and the result is what it says
squares = [n * n for n in numbers]
```

The comprehension is better here for a specific reason, and it is not brevity.
`squares` is complete on the line that creates it. There is no window during
which it exists and is half-built, and no possibility that something between the
two lines modifies it. You read one line and you know the whole value.

That property is what a comprehension buys. Everything below is about when the
price is too high.

## The one-sentence test

A comprehension should read as one sentence in English. If you can say it out
loud without backtracking, keep it.

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

Everything there is legal and the logic is probably right. But you cannot say it
in a sentence, you cannot put a breakpoint anywhere useful inside it, and when
it raises, the traceback points at the whole expression. This is the version a
reader should get instead:

```python
result = []
for group in groups:
    for user in group.members:
        if not is_eligible(user, cutoff):
            continue
        result.append(render(user))
```

Longer, and each line does one thing you can step through.

## Filter versus conditional expression

Two different `if`s live in a comprehension, and mixing them up is the most
common source of confusion.

```python
# Filter — comes after the for, decides whether an item is produced
evens = [n for n in numbers if n % 2 == 0]

# Conditional expression — comes before the for, decides which value
signs = ["even" if n % 2 == 0 else "odd" for n in numbers]
```

The filter changes the *length* of the result. The conditional expression
changes the *contents*. You can use both at once, which is where it starts to
get hard to read:

```python
labels = ["big" if n > 100 else "small" for n in numbers if n > 0]
```

There is no `else` on a filter, because a filter is not choosing between two
things. If you write `if ... else` after the `for`, Python will reject it.

## Nested loops read outer to inner

Multiple `for` clauses run in the order you would write them as nested loops —
left is outermost.

```python
pairs = [(x, y) for x in rows for y in cols]

# equivalent to
pairs = []
for x in rows:
    for y in cols:
        pairs.append((x, y))
```

Flattening is the case where this genuinely reads well:

```python
flat = [item for row in matrix for item in row]
```

Nesting a comprehension *inside* a comprehension is the case where it does not,
because the reading order flips — the inner brackets are evaluated per item of
the outer loop, so you read right-to-left and then left-to-right:

```python
transposed = [[row[i] for row in matrix] for i in range(len(matrix[0]))]
```

That is correct, and `zip(*matrix)` says the same thing in a form you can check
at a glance. Reach for the standard library before reaching for a second level
of brackets.

## What a comprehension cannot do

Some limits are syntactic and worth knowing before you fight them:

- **No statements.** No `try`/`except`, no `break`, no `continue`, no assignment
  statements. If an element might raise and you want to skip it, you need a
  loop, or a helper function that catches and returns a sentinel.
- **No accumulation across items.** Anything where element *n* depends on the
  result so far is a loop, or `itertools.accumulate`, or `functools.reduce`.
- **Side effects do not belong in one.** A comprehension whose result you discard
  is a loop written to look like a value:

```python
# Don't — builds a list of None for its side effects
[send_email(u) for u in users]

# Do
for user in users:
    send_email(user)
```

## The walrus, for the value you need twice

When the filter and the output both need the same expensive call, `:=` computes
it once.

```python
# Calls parse() twice per line
records = [parse(line) for line in lines if parse(line) is not None]

# Calls it once
records = [record for line in lines if (record := parse(line)) is not None]
```

This is one of the few places the walrus operator clearly earns its keep. It also
scales badly — two of them in one comprehension is a loop in disguise.

## Dict and set comprehensions

Same syntax, different brackets.

```python
by_id = {u.id: u for u in users}
domains = {email.split("@")[1] for email in emails}
```

`{}` alone is an empty dict, not an empty set. `set()` is the empty set.

A dict comprehension over a source with duplicate keys keeps the **last**
occurrence silently, which is either exactly what you want or a bug you will find
much later:

```python
by_email = {u.email: u for u in users}   # two users, one email -> one survives
```

If that matters, group instead:

```python
from collections import defaultdict

by_email = defaultdict(list)
for user in users:
    by_email[user.email].append(user)
```

## Generator expressions

Replace the brackets with parentheses and nothing is built. You get an iterator
that produces values as they are requested.

```python
squares = (n * n for n in numbers)   # nothing computed yet
total = sum(squares)                 # computed now, one at a time
```

Three reasons to prefer one:

**Memory.** `sum([n * n for n in range(10_000_000)])` materialises ten million
integers in a list. The generator version holds one at a time.

**Short-circuiting.** `any` and `all` stop at the first decisive element, so the
generator stops producing.

```python
if any(u.is_admin for u in users):   # stops at the first admin
    ...
```

With a list comprehension inside, every user is checked before `any` even runs.

**Streaming.** A generator over a file reads line by line, so the file never has
to fit in memory.

```python
with open("access.log") as f:
    errors = (line for line in f if " 500 " in line)
    first_ten = list(itertools.islice(errors, 10))
```

When a generator expression is the only argument to a function, the parentheses
are optional:

```python
total = sum(n * n for n in numbers)          # fine
total = sum((n * n for n in numbers), 0)     # needs its own parens here
```

### The two traps

**A generator is consumed once.** After you iterate it, it is empty, and it does
not tell you so — it just yields nothing.

```python
results = (expensive(x) for x in items)
print(len(list(results)))   # 3
print(list(results))        # [] — already exhausted
```

If you need the values twice, materialise with `list()`.

**Laziness means the loop variable is read late.** This bites when the source
changes between creation and consumption:

```python
threshold = 10
matches = (n for n in numbers if n > threshold)
threshold = 100
print(list(matches))   # filtered by 100, not 10
```

The first iterable is evaluated immediately; everything else runs when you
consume it. If the surrounding state moves, a generator is the wrong tool.

## Scope

A comprehension has its own scope in Python 3, so the loop variable does not
leak:

```python
n = "unchanged"
squares = [n * n for n in range(5)]
print(n)   # "unchanged"
```

The exception is class bodies. A comprehension inside a class body cannot see
the class's other names, because its scope does not include the class namespace:

```python
class Config:
    defaults = [1, 2, 3]
    doubled = [d * 2 for d in defaults]           # works — leftmost iterable
    scaled = [d * factor for d in defaults]       # NameError if factor is a class attribute
```

The leftmost iterable is evaluated in the enclosing scope, which is why the first
one works and anything else referring to a class attribute does not.

## Speed, honestly

A list comprehension is somewhat faster than the equivalent `append` loop,
because it avoids a method lookup and a function call per iteration. On a
million items that is tens of milliseconds. It is a real difference and it is
almost never the reason to choose one.

Choose a comprehension because the result reads as a single value. If it also
happens to be faster, that is a bonus, not an argument.

## Practice

The syntax basics — slicing, list, dict and set comprehensions — are covered in
the [Data Structures Guide](/tutorials/python-data-structures-guide), and
`yield`-based generators in [Advanced Python](/tutorials/python-advanced).

Work through the exercises on the [Python track](/tracks/python) to practise
choosing between the two forms. The data structures and functions exercises are
the closest fit, and the code review exercises there include code that is correct
and unreadable, which is the failure mode this page is about.
