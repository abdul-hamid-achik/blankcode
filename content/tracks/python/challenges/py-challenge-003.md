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

Write your complete implementation below:

```python
# Your implementation here
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
