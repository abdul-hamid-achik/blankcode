---
title: "Python Data Structures Guide"
slug: "python-data-structures-guide"
description: "Master lists, dictionaries, sets, tuples, and comprehensions in Python."
track: "python"
order: 2
difficulty: "beginner"
tags: ["basics", "lists", "dicts", "comprehensions", "sets", "tuples", "unpacking"]
---

# Python Data Structures Guide

Choosing the right data structure is one of the most important decisions you make when writing Python. This tutorial covers the built-in collections you will use every day, along with comprehensions that make working with them concise and expressive.

## Lists

Lists are ordered, mutable sequences that can hold items of any type. They are the most commonly used data structure in Python.

### Slicing

Slicing lets you extract portions of a list using the syntax `list[start:stop:step]`. The `start` index is inclusive, `stop` is exclusive.

```python
nums = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

print(nums[2:5])    # [2, 3, 4]
print(nums[:3])     # [0, 1, 2]
print(nums[7:])     # [7, 8, 9]
print(nums[::2])    # [0, 2, 4, 6, 8]  (every other)
print(nums[::-1])   # [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]  (reversed)
```

### Common List Methods

```python
fruits = ["apple", "banana"]

fruits.append("cherry")       # add to end
fruits.extend(["date", "fig"]) # add multiple items
fruits.insert(1, "avocado")   # insert at index

fruits.remove("banana")       # remove first occurrence
last = fruits.pop()            # remove and return last item
fruits.sort()                  # sort in place
fruits.reverse()               # reverse in place

print(fruits.index("apple"))  # index of first occurrence
print(fruits.count("apple"))  # number of occurrences

print(fruits)
# ['date', 'cherry', 'avocado', 'apple']
```

## Dictionaries

Dictionaries store key-value pairs with O(1) average lookup time. Keys must be hashable (strings, numbers, tuples of hashable items).

```python
scores = {"alice": 95, "bob": 82, "carol": 91}

# access and update
scores["dave"] = 88
scores["bob"] = 85

# safe access with default
print(scores.get("eve", 0))  # 0

# useful methods
print(list(scores.keys()))    # ['alice', 'bob', 'carol', 'dave']
print(list(scores.values()))  # [95, 85, 91, 88]
print(list(scores.items()))   # [('alice', 95), ('bob', 85), ...]

# merge dictionaries (Python 3.9+)
defaults = {"theme": "dark", "lang": "en"}
overrides = {"lang": "fr", "font_size": 14}
config = defaults | overrides
print(config)  # {'theme': 'dark', 'lang': 'fr', 'font_size': 14}
```

### setdefault and defaultdict

When building up dictionaries, `setdefault` and `collections.defaultdict` save you from checking whether keys exist.

```python
from collections import defaultdict

# group words by first letter
words = ["apple", "avocado", "banana", "blueberry", "cherry"]
groups = defaultdict(list)

for word in words:
    groups[word[0]].append(word)

print(dict(groups))
# {'a': ['apple', 'avocado'], 'b': ['banana', 'blueberry'], 'c': ['cherry']}
```

### Counter

`collections.Counter` is one of the most commonly used data structures for counting occurrences.

```python
from collections import Counter

words = ["apple", "banana", "apple", "cherry", "banana", "apple"]
counts = Counter(words)

print(counts)                # Counter({'apple': 3, 'banana': 2, 'cherry': 1})
print(counts.most_common(2)) # [('apple', 3), ('banana', 2)]
print(counts["banana"])      # 2

# counters support arithmetic
more_words = Counter(["apple", "date"])
combined = counts + more_words
print(combined)  # Counter({'apple': 4, 'banana': 2, 'cherry': 1, 'date': 1})
```

## Sets

Sets are unordered collections of unique elements. They support mathematical set operations and are useful for deduplication and membership testing.

```python
a = {1, 2, 3, 4}
b = {3, 4, 5, 6}

print(a | b)   # {1, 2, 3, 4, 5, 6}  union
print(a & b)   # {3, 4}               intersection
print(a - b)   # {1, 2}               difference
print(a ^ b)   # {1, 2, 5, 6}         symmetric difference

# fast membership testing
valid_ids = {101, 102, 103, 200, 305}
print(200 in valid_ids)  # True

# deduplication
names = ["alice", "bob", "alice", "carol", "bob"]
unique = list(set(names))
print(unique)  # ['alice', 'bob', 'carol'] (order not guaranteed)
```

## Tuples

Tuples are immutable sequences. Use them when you need a fixed collection of items, such as returning multiple values from a function or using composite dictionary keys.

```python
point = (3, 4)
x, y = point  # unpacking
print(f"x={x}, y={y}")

# tuples as dictionary keys
distances = {}
distances[("NYC", "LA")] = 2451
distances[("NYC", "Chicago")] = 790

# named tuples for clarity
from collections import namedtuple

Color = namedtuple("Color", ["red", "green", "blue"])
sky = Color(135, 206, 235)
print(sky.red)    # 135
print(sky[1])     # 206
```

For more structured data with defaults, type hints, and methods, see `@dataclass` in the [Object-Oriented Python](/tutorials/python-object-oriented-python) tutorial.

## List Comprehensions

List comprehensions provide a concise way to create lists from existing iterables with optional filtering.

```python
# basic comprehension
squares = [x ** 2 for x in range(10)]
print(squares)  # [0, 1, 4, 9, 16, 25, 36, 49, 64, 81]

# with condition
evens = [x for x in range(20) if x % 2 == 0]
print(evens)  # [0, 2, 4, 6, 8, 10, 12, 14, 16, 18]

# transform and filter
words = ["Hello", "WORLD", "Python", "IS", "great"]
short_lower = [w.lower() for w in words if len(w) <= 5]
print(short_lower)  # ['hello', 'world', 'is', 'great']

# nested comprehension (flatten a matrix)
matrix = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
flat = [n for row in matrix for n in row]
print(flat)  # [1, 2, 3, 4, 5, 6, 7, 8, 9]
```

## Dict and Set Comprehensions

The same comprehension syntax works for dictionaries and sets.

```python
# dict comprehension
names = ["alice", "bob", "carol"]
name_lengths = {name: len(name) for name in names}
print(name_lengths)  # {'alice': 5, 'bob': 3, 'carol': 5}

# invert a dictionary
original = {"a": 1, "b": 2, "c": 3}
inverted = {v: k for k, v in original.items()}
print(inverted)  # {1: 'a', 2: 'b', 3: 'c'}

# set comprehension
sentence = "the quick brown fox jumps over the lazy dog"
vowels_used = {ch for ch in sentence if ch in "aeiou"}
print(vowels_used)  # {'a', 'e', 'i', 'o', 'u'}
```

## Unpacking, enumerate, and zip

These built-in features make iteration cleaner and more Pythonic.

```python
# extended unpacking
first, *middle, last = [1, 2, 3, 4, 5]
print(first, middle, last)  # 1 [2, 3, 4] 5

# enumerate gives you index + value
languages = ["Python", "Rust", "Go"]
for i, lang in enumerate(languages):
    print(f"{i}: {lang}")
# 0: Python
# 1: Rust
# 2: Go

# zip pairs elements from multiple iterables
names = ["Alice", "Bob", "Carol"]
scores = [95, 82, 91]
for name, score in zip(names, scores):
    print(f"{name}: {score}")

# create a dict from two lists
roster = dict(zip(names, scores))
print(roster)  # {'Alice': 95, 'Bob': 82, 'Carol': 91}
```

## Practice

Try writing a function that takes a list of dictionaries (each with `"name"` and `"score"` keys) and returns a dictionary mapping grade letters to lists of names. Use comprehensions where it makes sense.

Next up: [Object-Oriented Python](/tutorials/python-object-oriented-python)
