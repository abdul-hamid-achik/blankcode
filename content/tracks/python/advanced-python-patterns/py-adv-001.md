---
slug: python-advanced-patterns-context-manager
title: Building a Simple Context Manager
description: Learn to create a custom context manager using the __enter__ and __exit__ methods to manage resources safely.
difficulty: beginner
hints:
  - The __enter__ method is called when entering the 'with' block
  - The __exit__ method is called when leaving the 'with' block, even if an error occurs
  - __exit__ receives three arguments about any exception that occurred
  - Remember to return the resource from __enter__ so it can be assigned with 'as'
tags:
  - context-managers
  - resource-management
  - dunder-methods
  - with-statement
---

Create a simple context manager class that manages a file-like resource. Context managers are a powerful Python pattern that ensures resources are properly acquired and released, even when errors occur.

Your `FileLogger` class should:
1. Store a filename in `__init__`
2. Open the file in `__enter__` and return the file object
3. Close the file in `__exit__`, regardless of whether an exception occurred
4. Print status messages when opening and closing

```python
class FileLogger:
    def __init__(self, filename):
        self.filename = filename
        self.file = None
    
    def ___blank_start____enter____blank_end___(self):
        """Called when entering the 'with' block"""
        print(f"Opening {self.filename}")
        self.file = open(self.filename, 'w')
        return ___blank_start___self.file___blank_end___
    
    def ___blank_start____exit____blank_end___(self, exc_type, exc_val, exc_tb):
        """Called when exiting the 'with' block"""
        if self.file:
            print(f"Closing {self.filename}")
            ___blank_start___self.file.close()___blank_end___
        return False  # Don't suppress exceptions

# Usage example
with FileLogger("test.log") as f:
    f.write("Hello, World!\n")
    f.write("Context managers are awesome!\n")
```

## Tests

```python
import os
import tempfile


def test_context_manager_closes_file():
    temp = tempfile.NamedTemporaryFile(delete=False)
    temp.close()
    logger = FileLogger(temp.name)
    with logger as f:
        f.write("Hello, World!\n")
    assert logger.file.closed
    with open(temp.name, "r") as f:
        assert f.read().strip() == "Hello, World!"
    os.unlink(temp.name)
```
