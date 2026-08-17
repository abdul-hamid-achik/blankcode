---
title: "Python Data Structures Guide"
slug: "python-data-structures-guide"
description: "Lists, dicts, sets, and tuples: what each one actually costs, and which operations quietly mutate the original."
track: "python"
order: 2
difficulty: "beginner"
tags: ["basics", "lists", "dicts", "comprehensions", "sets", "tuples", "unpacking"]
practice:
  concept: "data-structures"
  label: "Data structures"
---

Every one of Python's four built-in collections solves a different problem —
ordered sequence, key lookup, membership test, fixed record — and most bugs
in code that uses them come from picking the wrong one, not from misusing
the right one. This is what each is for, what it costs, and the handful of
operations that behave differently than they look like they should.

## Lists and Slicing

A list is ordered and mutable. Indexing and slicing use
`list[start:stop:step]`, with `start` inclusive and `stop` exclusive — the
same half-open rule as `range`.

```python
nums = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
print(nums[2:5])     # [2, 3, 4]
print(nums[::2])     # [0, 2, 4, 6, 8]
print(nums[::-1])    # [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]

fruits = ["apple", "banana"]
fruits.append("cherry")
fruits.extend(["date", "fig"])
fruits.sort()
last = fruits.pop()
```

Slicing never raises `IndexError`, even with an out-of-range boundary —
`nums[2:1000]` just returns everything from index 2 onward. Single-element
indexing (`nums[1000]`) does raise. That asymmetry is worth knowing before
you rely on a slice to validate a range instead of clamping it yourself.

Slice assignment replaces a chunk of the list in place, and the replacement
doesn't have to be the same length:

```python
nums = [0, 1, 2, 3, 4]
nums[1:3] = [10, 20, 30]
print(nums)   # [0, 10, 20, 30, 3, 4] — two items became three
```

`.sort()` sorts in place and returns `None`. `sorted()` returns a new list
and leaves the original alone. `fruits = fruits.sort()` is a real bug
pattern that ships more often than it should — `fruits` becomes `None`.

::code-blank{lang="python" href="/tracks/python/data-structures" label="practice data structures for real"}
---
code: |
  fruits = ["apple", "banana", "cherry"]
  last = fruits.___blank_start___pop___blank_end___()
---
::

## Dictionaries

A dict maps hashable keys to values with average O(1) lookup. It has kept
insertion order since Python 3.7 — that's a language guarantee now, not an
implementation accident, so code that relies on it is portable.

```python
scores = {"alice": 95, "bob": 82}
scores["carol"] = 91
print(scores.get("eve", 0))   # 0 — safe default, no KeyError

defaults = {"theme": "dark", "lang": "en"}
config = defaults | {"lang": "fr"}   # merge, Python 3.9+
```

`setdefault` and `collections.defaultdict` remove the "check, then insert"
boilerplate when you're building a dict from a stream of items:

```python
from collections import defaultdict

groups = defaultdict(list)
for word in ["apple", "avocado", "banana"]:
    groups[word[0]].append(word)
print(dict(groups))   # {'a': ['apple', 'avocado'], 'b': ['banana']}
```

`collections.Counter` is a dict subclass specialized for counting, and it
supports arithmetic between counters:

```python
from collections import Counter
counts = Counter(["apple", "banana", "apple"])
print(counts.most_common(1))   # [('apple', 2)]
```

::code-blank{lang="python" href="/tracks/python/data-structures" label="practice data structures for real"}
---
code: |
  from collections import defaultdict

  groups = defaultdict(list)
  for word in words:
      groups[word[0]].___blank_start___append___blank_end___(word)
---
::

## Sets

A set is an unordered collection of unique, hashable elements, backed by the
same hash table as a dict. That's why membership testing is O(1) — `x in
some_set` doesn't scan, it hashes `x` and looks up the bucket, exactly the
way `some_dict[x]` does.

```python
a, b = {1, 2, 3, 4}, {3, 4, 5, 6}
print(a | b)    # union
print(a & b)    # intersection
print(a - b)    # difference

names = ["alice", "bob", "alice"]
unique = list(set(names))   # order not guaranteed
```

Hashability is why a list can't go in a set — lists are mutable, so their
hash would have to change as they change, which breaks the table a set
relies on. A tuple of hashable items works fine.

## Tuples and Unpacking

A tuple is an immutable sequence. "Immutable" means the tuple's own slots
can't be reassigned — it does not mean everything inside is frozen. A tuple
holding a list still lets you mutate that list.

```python
point = (3, 4)
x, y = point

first, *middle, last = [1, 2, 3, 4, 5]
print(first, middle, last)   # 1 [2, 3, 4] 5

from collections import namedtuple
Color = namedtuple("Color", ["red", "green", "blue"])
sky = Color(135, 206, 235)
print(sky.red, sky[1])       # 135 206
```

Use a tuple for a fixed, heterogeneous record — a coordinate, a row, a
function returning more than one value. Reach for `@dataclass` once the
record needs a name, defaults, or methods of its own; see
[Object-Oriented Python](/tutorials/python/object-oriented-python).

::code-blank{lang="python" href="/tracks/python/data-structures" label="practice data structures for real"}
---
code: |
  first, *middle, ___blank_start___last___blank_end___ = [1, 2, 3, 4, 5]
  print(first, middle, last)  # 1 [2, 3, 4] 5
---
::

## Comprehensions, Briefly

The same bracket syntax that builds a list builds a dict or a set — swap the
brackets for `{}`, and whether you write a bare expression or a `key: value`
pair decides which one you get.

```python
squares = [n * n for n in range(10)]
name_lengths = {name: len(name) for name in names}
vowels_used = {ch for ch in sentence if ch in "aeiou"}
```

`{}` alone is an empty dict, not an empty set — `set()` is the only way to
write an empty set literal. For when a comprehension makes code clearer and
when it hides the logic, see
[Comprehensions Without Regret](/tutorials/python/comprehensions-without-regret).

## Where This Bites

**`.sort()` returns `None`.** It sorts in place on purpose — reassigning the
result throws the list away. Use `sorted()` when you need a new list and
want to keep the original intact.

**`in` on a list is O(n); `in` on a set or dict is O(1).** Checking
membership against a list inside a loop turns a fast operation into a slow
one as the list grows. Convert to a set first if you're testing membership
more than once.

**A shallow copy only copies one level.** `list(old)`, `old.copy()`, and
`old[:]` all give you a new outer list whose *elements* are still shared
with the original. If those elements are themselves mutable, mutating one
through either list mutates both — use `copy.deepcopy` when the structure is
nested.

**A tuple's immutability doesn't reach inside it.** `t = ([1, 2], 3)` is a
tuple you can't reassign, holding a list you very much can. Don't use a
tuple as a stand-in for "this data can't change" without checking what's
actually inside it.
