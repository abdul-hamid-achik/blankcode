---
slug: py-challenge-003
title: 'Challenge: Build a Context Manager for Database Connections'
description: Create a context manager that handles database connection lifecycle.
difficulty: advanced
type: challenge
tags:
  - context-managers
  - decorators
  - resource-management
---

# Challenge: Database Context Manager

## Requirements

Create a `DatabaseConnection` context manager with the following features:

1. **__enter__()** - Opens connection and returns self
2. **__exit__()** - Closes connection, handles exceptions
3. **execute(query: str, params: tuple) -> Cursor** - Execute SQL query
4. **commit()** - Commit transaction
5. **rollback()** - Rollback transaction on error
6. **@transaction decorator** - Auto-commits or rolls back

## Constraints

- Use contextlib or implement context manager protocol
- Auto-rollback on exceptions
- Connection pooling simulation
- Log all operations
- Handle nested transactions

Write your complete implementation below:

```python
# Your implementation here
```

## Example Usage

```python
with DatabaseConnection() as db:
    db.execute("INSERT INTO users VALUES (%s, %s)", (1, "John"))
    db.commit()

@transaction
def transfer(from_id, to_id, amount):
    db.execute("UPDATE accounts SET balance = balance - %s WHERE id = %s", (amount, from_id))
    db.execute("UPDATE accounts SET balance = balance + %s WHERE id = %s", (amount, to_id))
```

## Tests

```python
import pytest
from unittest.mock import Mock, patch

def test_context_manager_enters():
    with DatabaseConnection() as db:
        assert db.connected == True
        assert db.cursor is not None

def test_context_manager_exits():
    with DatabaseConnection() as db:
        pass
    assert db.connected == False

def test_context_manager_rollback_on_exception():
    with pytest.raises(ValueError):
        with DatabaseConnection() as db:
            db.execute("INSERT INTO users VALUES (%s)", (1,))
            raise ValueError("Test error")
    # Should have rolled back
    assert db.transaction_committed == False

def test_execute_query():
    with DatabaseConnection() as db:
        db.execute("SELECT * FROM users WHERE id = %s", (1,))
        assert db.last_query == "SELECT * FROM users WHERE id = %s"
        assert db.last_params == (1,)

def test_commit():
    with DatabaseConnection() as db:
        db.commit()
        assert db.transaction_committed == True

def test_rollback():
    with DatabaseConnection() as db:
        db.execute("INSERT INTO users VALUES (%s)", (1,))
        db.rollback()
        assert db.transaction_rolled_back == True

def test_transaction_decorator_success():
    @transaction
    def add_user(db, user_id, name):
        db.execute("INSERT INTO users VALUES (%s, %s)", (user_id, name))
    
    with DatabaseConnection() as db:
        add_user(db, 1, "John")
        assert db.transaction_committed == True

def test_transaction_decorator_failure():
    @transaction
    def add_user(db, user_id, name):
        db.execute("INSERT INTO users VALUES (%s, %s)", (user_id, name))
        raise ValueError("Error")
    
    with DatabaseConnection() as db:
        with pytest.raises(ValueError):
            add_user(db, 1, "John")
        assert db.transaction_rolled_back == True

def test_nested_transactions():
    with DatabaseConnection() as db:
        with db.transaction():
            db.execute("INSERT INTO users VALUES (%s)", (1,))
            with db.transaction():
                db.execute("INSERT INTO users VALUES (%s)", (2,))
        assert db.transaction_committed == True

def test_connection_pooling():
    connections = []
    for i in range(5):
        with DatabaseConnection() as db:
            connections.append(id(db))
    
    # Should reuse connections from pool
    assert len(set(connections)) < 5
```

## Solution

```python
from functools import wraps


class Cursor:
    def __init__(self) -> None:
        self.rows: list = []


class DatabaseConnection:
    """A connection with a pool, transaction tracking and a decorator.

    There is no real database here — the point of the exercise is the
    lifecycle, so the connection records what it was asked to do.
    """

    _pool: list["DatabaseConnection"] = []

    def __new__(cls) -> "DatabaseConnection":
        # Reusing an idle connection is the whole reason a pool exists: opening
        # one is the expensive part, and callers create them freely.
        if cls._pool:
            return cls._pool.pop()
        return super().__new__(cls)

    def __init__(self) -> None:
        self.connected = False
        self.cursor: Cursor | None = None
        self.last_query: str | None = None
        self.last_params: tuple | None = None
        self.transaction_committed = False
        self.transaction_rolled_back = False
        self._depth = 0

    def __enter__(self) -> "DatabaseConnection":
        self.connected = True
        self.cursor = Cursor()
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        # An exception escaping the block means the work is incomplete, so the
        # transaction must not survive it.
        if exc_type is not None:
            self.rollback()
        self.connected = False
        self.cursor = None
        type(self)._pool.append(self)
        return False

    def execute(self, query: str, params: tuple = ()) -> Cursor:
        if not self.connected:
            raise RuntimeError("connection is closed")
        self.last_query = query
        self.last_params = params
        return self.cursor

    def commit(self) -> None:
        self.transaction_committed = True
        self.transaction_rolled_back = False

    def rollback(self) -> None:
        self.transaction_rolled_back = True
        self.transaction_committed = False

    def transaction(self) -> "_Transaction":
        return _Transaction(self)


class _Transaction:
    """Nested blocks join the outermost transaction rather than starting their
    own, so an inner block cannot commit work the outer one has not finished."""

    def __init__(self, connection: DatabaseConnection) -> None:
        self.connection = connection

    def __enter__(self) -> DatabaseConnection:
        self.connection._depth += 1
        return self.connection

    def __exit__(self, exc_type, exc, tb) -> bool:
        self.connection._depth -= 1
        if exc_type is not None:
            self.connection.rollback()
        elif self.connection._depth == 0:
            self.connection.commit()
        return False


def transaction(func):
    """Commits when the wrapped function returns, rolls back when it raises.

    The connection is the first argument, which is what lets the decorator stay
    ignorant of everything else the function takes.
    """

    @wraps(func)
    def wrapper(connection: DatabaseConnection, *args, **kwargs):
        try:
            result = func(connection, *args, **kwargs)
        except Exception:
            connection.rollback()
            raise
        connection.commit()
        return result

    return wrapper
```
