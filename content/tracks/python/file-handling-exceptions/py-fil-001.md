---
slug: python-file-handling-exceptions-001
title: Safe File Reading with Exception Handling
description: Learn how to safely read files using try-except blocks to handle common file-related exceptions in Python.
difficulty: beginner
hints:
  - Use FileNotFoundError to catch when a file doesn't exist
  - The 'with' statement automatically closes files even if an error occurs
  - You can catch multiple exceptions using separate except blocks
  - Always provide helpful error messages to users
tags:
  - file-handling
  - exceptions
  - try-except
  - error-handling
---

In this exercise, you'll write a function that safely reads a file and handles common errors that might occur. Your function should:
1. Attempt to open and read a file
2. Handle the case when the file doesn't exist
3. Handle the case when you don't have permission to read the file
4. Return the file contents if successful, or an error message if not

Complete the blanks to implement proper exception handling for file operations.

```python
def safe_read_file(filename):
    """
    Safely read a file and handle potential errors.
    
    Args:
        filename: The name of the file to read
        
    Returns:
        A dictionary with 'success' (bool) and either 'content' or 'error' keys
    """
    try:
        ___blank_start___with open(filename, 'r') as file___blank_end___:
            content = file.read()
            return {"success": True, "content": content}
    
    ___blank_start___except FileNotFoundError___blank_end___:
        return {"success": False, "error": f"File '{filename}' not found"}
    
    ___blank_start___except PermissionError___blank_end___:
        return {"success": False, "error": f"Permission denied to read '{filename}'"}
    
    ___blank_start___except Exception as e___blank_end___:
        return {"success": False, "error": f"An unexpected error occurred: {str(e)}"}
```

## Tests

```python
import os
import tempfile


def test_safe_read_file_success_and_errors():
    fd, path = tempfile.mkstemp()
    os.close(fd)
    try:
        with open(path, "w") as file:
            file.write("Hello")
        result = safe_read_file(path)
        assert result["success"] is True
        assert result["content"] == "Hello"
    finally:
        os.unlink(path)

    missing = safe_read_file("does-not-exist.txt")
    assert missing["success"] is False
    assert "not found" in missing["error"].lower()
```
