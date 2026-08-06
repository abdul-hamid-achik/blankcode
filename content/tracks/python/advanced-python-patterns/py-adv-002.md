---
slug: python-advanced-patterns-context-manager-append-log
title: Context Manager for Append-Only File Logging
description: Learn how to create a custom context manager using the __enter__ and __exit__ magic methods, this time opening a log file in append mode so repeated runs never overwrite history.
difficulty: intermediate
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

Create a context manager class called `FileLogger` that automatically opens a log file **in append mode**, allows writing to it, and ensures it's properly closed when done. Because it appends rather than overwrites, running the same script twice preserves both runs' output — a common requirement for real log files.

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
    
    ___blank_start___def __enter__(self)___blank_end___:
        """Called when entering the 'with' block"""
        self.file = open(self.filename, 'a')
        return ___blank_start___self.file___blank_end___
    
    ___blank_start___def __exit__(self, exc_type, exc_value, traceback)___blank_end___:
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
