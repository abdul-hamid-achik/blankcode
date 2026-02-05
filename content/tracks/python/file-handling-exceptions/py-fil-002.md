---
slug: python-file-handling-exceptions-safe-read
title: Safe File Reading with Exception Handling
description: Learn to handle common file-related exceptions when reading files in Python, including FileNotFoundError and PermissionError.
difficulty: beginner
hints:
  - Use try-except blocks to catch specific exceptions
  - FileNotFoundError occurs when a file doesn't exist
  - The 'with' statement automatically closes files even when errors occur
  - You can catch multiple exception types in separate except blocks
tags:
  - file-handling
  - exceptions
  - error-handling
  - try-except
---

Complete the function that safely reads a file and handles common exceptions. The function should:
- Try to open and read the specified file
- Return the file contents if successful
- Handle `FileNotFoundError` and return "Error: File not found"
- Handle `PermissionError` and return "Error: Permission denied"
- Handle any other exceptions and return "Error: Unknown error occurred"

```python
def safe_read_file(filename):
    """
    Safely read a file and handle exceptions.
    
    Args:
        filename: Path to the file to read
        
    Returns:
        File contents as string, or an error message
    """
    ___blank_start___try___blank_end___:
        with open(filename, 'r') as file:
            content = file.read()
            return content
    ___blank_start___except FileNotFoundError___blank_end___:
        return "Error: File not found"
    ___blank_start___except PermissionError___blank_end___:
        return "Error: Permission denied"
    ___blank_start___except Exception___blank_end___:
        return "Error: Unknown error occurred"
```

## Tests

```python
import os
import tempfile


def test_safe_read_file_errors_and_success():
    missing = safe_read_file("does-not-exist.txt")
    assert missing == "Error: File not found"

    fd, path = tempfile.mkstemp()
    os.close(fd)
    try:
        with open(path, "w") as file:
            file.write("Hello, World!")
        result = safe_read_file(path)
        assert result == "Hello, World!"
    finally:
        os.unlink(path)
```
