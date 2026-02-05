---
slug: python-advanced-patterns-context-manager
title: Building a Simple Context Manager
description: Learn how to create a custom context manager using the __enter__ and __exit__ magic methods to manage resources safely.
difficulty: beginner
hints:
  - The __enter__ method is called when entering the 'with' block
  - The __exit__ method is called when leaving the 'with' block, even if an exception occurs
  - __exit__ receives three parameters for exception handling (exc_type, exc_value, traceback)
  - Remember to return the resource from __enter__ so it can be used in the 'with' statement
tags:
  - context-managers
  - magic-methods
  - resource-management
  - with-statement
---

Create a context manager class called `FileLogger` that automatically opens a log file, allows writing to it, and ensures it's properly closed when done. Context managers are a powerful Python pattern that guarantees resource cleanup.

Your context manager should:
- Open a file in append mode when entering the context
- Return the file object for use in the `with` block
- Automatically close the file when exiting the context
- Handle the file properly even if an error occurs

```python
class FileLogger:
    def __init__(self, filename):
        self.filename = filename
        self.file = None
    
    def ___blank_start____enter____blank_end___(self):
        """Called when entering the 'with' block"""
        self.file = open(self.filename, 'a')
        return ___blank_start___self.file___blank_end___
    
    def ___blank_start____exit____blank_end___(self, exc_type, exc_value, traceback):
        """Called when exiting the 'with' block"""
        if self.file:
            ___blank_start___self.file.close()___blank_end___
        return False  # Don't suppress exceptions

# Usage example:
# with FileLogger('app.log') as log_file:
#     log_file.write('Application started\n')
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
        assert "Hello, World!" in f.read()
    os.unlink(temp.name)
```
