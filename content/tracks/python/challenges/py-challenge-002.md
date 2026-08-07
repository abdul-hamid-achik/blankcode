---
slug: py-challenge-002
title: 'Challenge: Build a File Statistics Analyzer'
description: Create a utility to analyze file contents and return statistics.
difficulty: intermediate
type: challenge
tags:
  - file-io
  - data-structures
  - string-manipulation
---

# Challenge: File Statistics Analyzer

## Requirements

Create a `FileStats` class that analyzes text files and provides the following statistics:

1. **Constructor** - Accepts a file path string
2. **line_count() -> int** - Returns total number of lines
3. **word_count() -> int** - Returns total number of words
4. **char_count() -> int** - Returns total number of characters (including whitespace)
5. **char_count_no_spaces() -> int** - Returns character count excluding spaces
6. **average_word_length() -> float** - Returns average word length rounded to 2 decimals
7. **most_common_word() -> str | None** - Returns the most frequently occurring word (case-insensitive)
8. **unique_words() -> int** - Returns count of unique words

## Constraints

- Handle file not found errors gracefully
- Words are separated by whitespace
- Ignore punctuation when counting words
- Empty files should return 0 for counts and None for most_common_word
- Strip newlines when reading

Write your complete implementation below:

```python
# Your implementation here
```

## Example Usage

```python
stats = FileStats('sample.txt')
stats.line_count()           # Returns number of lines
stats.word_count()           # Returns number of words
stats.most_common_word()     # Returns most frequent word
```

## Tests

```python
import pytest
import tempfile
import os

@pytest.fixture
def sample_file():
    content = "Hello world\nHello Python\nHello World"
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
        f.write(content)
        path = f.name
    yield path
    os.unlink(path)

@pytest.fixture
def empty_file():
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
        path = f.name
    yield path
    os.unlink(path)

def test_line_count(sample_file, empty_file):
    assert FileStats(sample_file).line_count() == 3
    assert FileStats(empty_file).line_count() == 0

def test_word_count(sample_file, empty_file):
    assert FileStats(sample_file).word_count() == 6
    assert FileStats(empty_file).word_count() == 0

def test_char_count(sample_file):
    content = "Hello world\nHello Python\nHello World"
    assert FileStats(sample_file).char_count() == len(content)

def test_average_word_length(sample_file):
    # "Hello" (5), "world" (5), "Hello" (5), "Python" (6), "Hello" (5), "World" (5)
    # Average = (5+5+5+6+5+5) / 6 = 31/6 = 5.17
    assert abs(FileStats(sample_file).average_word_length() - 5.17) < 0.01

def test_most_common_word(sample_file):
    assert FileStats(sample_file).most_common_word().lower() == 'hello'

def test_unique_words(sample_file):
    # hello, world, python, World (case-insensitive: hello, world, python)
    assert FileStats(sample_file).unique_words() == 3

def test_file_not_found():
    with pytest.raises(FileNotFoundError):
        FileStats('nonexistent.txt').line_count()

def test_empty_file(empty_file):
    stats = FileStats(empty_file)
    assert stats.word_count() == 0
    assert stats.most_common_word() is None
    assert stats.average_word_length() == 0.0
```

## Solution

```python
from collections import Counter


class FileStats:
    def __init__(self, path: str) -> None:
        self.path = path
        self._content: str | None = None

    def _read(self) -> str:
        # Read lazily so constructing FileStats for a missing file is fine and
        # the FileNotFoundError surfaces from the call that needs the content.
        if self._content is None:
            with open(self.path, encoding="utf-8") as handle:
                self._content = handle.read()
        return self._content

    def _words(self) -> list[str]:
        return self._read().split()

    def line_count(self) -> int:
        content = self._read()
        if not content:
            return 0
        # An empty file has no lines; a file not ending in a newline still has
        # its last line, which is why splitlines is the right call here.
        return len(content.splitlines())

    def word_count(self) -> int:
        return len(self._words())

    def char_count(self) -> int:
        return len(self._read())

    def char_count_no_spaces(self) -> int:
        return len(self._read().replace(" ", ""))

    def average_word_length(self) -> float:
        words = self._words()
        if not words:
            return 0.0
        return round(sum(len(word) for word in words) / len(words), 2)

    def most_common_word(self) -> str | None:
        words = [word.lower() for word in self._words()]
        if not words:
            return None
        return Counter(words).most_common(1)[0][0]

    def unique_words(self) -> int:
        return len({word.lower() for word in self._words()})
```
