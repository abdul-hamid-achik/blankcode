---
slug: py-challenge-005
title: 'Challenge: Build a Simple ORM'
description: Create a basic Object-Relational Mapping system with query capabilities.
difficulty: expert
type: challenge
tags:
  - orm
  - metaclasses
  - database
---

# Challenge: Simple ORM

## Requirements

Create an ORM system with the following features:

1. **Model base class** - Base class for all models
2. **Field types** - IntegerField, StringField, TextField, DateTimeField
3. **objects manager** - QuerySet for database operations
4. **filter(**kwargs)** - Filter records
5. **all()** - Get all records
6. **first()** - Get first record
7. **get(id)** - Get record by ID
8. **save()** - Save instance
9. **delete()** - Delete instance

## Constraints

- Use metaclasses for model definition
- Support method chaining on QuerySet
- Auto-manage created_at/updated_at timestamps
- Lazy evaluation for queries
- Support basic field validation
- **The runtime has no `sqlite3` module.** Persist however you like — a JSON
  file behind the path you are given is enough. The exercise is about the ORM
  layer, not the storage engine.

Write your complete implementation below:

```python
from datetime import datetime
from typing import Any, Optional, List, Dict, Type

# Your implementation here
```

## Example Usage

```python
class User(Model):
    name = StringField(max_length=100)
    email = StringField(unique=True)
    age = IntegerField()
    
# Create table
User.create_table()

# Create record
user = User(name="John", email="john@example.com", age=30)
user.save()

# Query
users = User.objects.filter(age__gt=18).all()
john = User.objects.get(email="john@example.com")
```

## Tests

```python
import pytest
import os

@pytest.fixture
def orm_db():
    # Setup test database
    db_path = 'test_orm.db'
    yield db_path
    os.unlink(db_path)

def test_model_creation(orm_db):
    class User(Model):
        name = StringField(max_length=100)
        email = StringField()
    
    User.create_table(orm_db)
    user = User(name="John", email="john@example.com")
    user.save(orm_db)
    
    assert user.id is not None
    assert user.name == "John"

def test_model_save_and_retrieve(orm_db):
    class User(Model):
        name = StringField(max_length=100)
        email = StringField()
    
    User.create_table(orm_db)
    user = User(name="John", email="john@example.com")
    user.save(orm_db)
    
    retrieved = User.objects.get(orm_db, user.id)
    assert retrieved.name == "John"
    assert retrieved.email == "john@example.com"

def test_model_update(orm_db):
    class User(Model):
        name = StringField(max_length=100)
        email = StringField()
    
    User.create_table(orm_db)
    user = User(name="John", email="john@example.com")
    user.save(orm_db)
    
    user.name = "Jane"
    user.save(orm_db)
    
    retrieved = User.objects.get(orm_db, user.id)
    assert retrieved.name == "Jane"

def test_model_delete(orm_db):
    class User(Model):
        name = StringField(max_length=100)
    
    User.create_table(orm_db)
    user = User(name="John")
    user.save(orm_db)
    
    user.delete(orm_db)
    
    retrieved = User.objects.get(orm_db, user.id)
    assert retrieved is None

def test_queryset_filter(orm_db):
    class User(Model):
        name = StringField(max_length=100)
        age = IntegerField()
    
    User.create_table(orm_db)
    User(name="John", age=25).save(orm_db)
    User(name="Jane", age=30).save(orm_db)
    User(name="Bob", age=25).save(orm_db)
    
    users = User.objects.filter(orm_db, age=25).all()
    assert len(users) == 2

def test_queryset_filter_greater_than(orm_db):
    class User(Model):
        name = StringField(max_length=100)
        age = IntegerField()
    
    User.create_table(orm_db)
    User(name="John", age=25).save(orm_db)
    User(name="Jane", age=30).save(orm_db)
    User(name="Bob", age=35).save(orm_db)
    
    users = User.objects.filter(orm_db, age__gt=25).all()
    assert len(users) == 2

def test_queryset_filter_less_than(orm_db):
    class User(Model):
        name = StringField(max_length=100)
        age = IntegerField()
    
    User.create_table(orm_db)
    User(name="John", age=25).save(orm_db)
    User(name="Jane", age=30).save(orm_db)
    User(name="Bob", age=35).save(orm_db)
    
    users = User.objects.filter(orm_db, age__lt=30).all()
    assert len(users) == 1

def test_queryset_first(orm_db):
    class User(Model):
        name = StringField(max_length=100)
    
    User.create_table(orm_db)
    User(name="John").save(orm_db)
    User(name="Jane").save(orm_db)
    
    first = User.objects.all(orm_db).first()
    assert first.name == "John"

def test_queryset_chain_filters(orm_db):
    class User(Model):
        name = StringField(max_length=100)
        age = IntegerField()
        active = BooleanField(default=True)
    
    User.create_table(orm_db)
    User(name="John", age=25, active=True).save(orm_db)
    User(name="Jane", age=30, active=True).save(orm_db)
    User(name="Bob", age=25, active=False).save(orm_db)
    
    users = User.objects.filter(orm_db, age=25).filter(active=True).all()
    assert len(users) == 1
    assert users[0].name == "John"

def test_model_validation(orm_db):
    class User(Model):
        name = StringField(max_length=5)
    
    User.create_table(orm_db)
    user = User(name="VeryLongName")
    
    with pytest.raises(ValueError):
        user.save(orm_db)

def test_unique_field(orm_db):
    class User(Model):
        email = StringField(unique=True)
    
    User.create_table(orm_db)
    User(email="john@example.com").save(orm_db)
    
    with pytest.raises(ValueError):
        User(email="john@example.com").save(orm_db)

def test_auto_timestamps(orm_db):
    class User(Model):
        name = StringField(max_length=100)
    
    User.create_table(orm_db)
    before = datetime.now()
    user = User(name="John")
    user.save(orm_db)
    after = datetime.now()
    
    assert before <= user.created_at <= after
    assert before <= user.updated_at <= after

def test_queryset_count(orm_db):
    class User(Model):
        name = StringField(max_length=100)
    
    User.create_table(orm_db)
    User(name="John").save(orm_db)
    User(name="Jane").save(orm_db)
    
    count = User.objects.count(orm_db)
    assert count == 2

def test_queryset_order_by(orm_db):
    class User(Model):
        name = StringField(max_length=100)
        age = IntegerField()
    
    User.create_table(orm_db)
    User(name="John", age=30).save(orm_db)
    User(name="Jane", age=25).save(orm_db)
    User(name="Bob", age=35).save(orm_db)
    
    users = User.objects.order_by(orm_db, 'age').all()
    assert users[0].age == 25
    assert users[1].age == 30
    assert users[2].age == 35
```

## Solution

```python
import json
import os
from datetime import datetime


class Field:
    def __init__(self, max_length: int | None = None, unique: bool = False, default=None):
        self.max_length = max_length
        self.unique = unique
        self.default = default
        self.name = ""

    def validate(self, value) -> None:
        if value is None:
            return
        if self.max_length is not None and len(str(value)) > self.max_length:
            raise ValueError(f"{self.name} exceeds max_length of {self.max_length}")

    def to_db(self, value):
        return value

    def from_db(self, value):
        return value


class StringField(Field):
    pass


class TextField(Field):
    pass


class IntegerField(Field):
    pass


class BooleanField(Field):
    def to_db(self, value):
        return None if value is None else bool(value)

    def from_db(self, value):
        return None if value is None else bool(value)


class DateTimeField(Field):
    def to_db(self, value):
        return None if value is None else value.isoformat()

    def from_db(self, value):
        return None if value is None else datetime.fromisoformat(value)


class ResultList(list):
    """A list that also answers `.first()`, so `all()` can be indexed, counted
    and asked for its head without callers knowing which they will need."""

    def first(self):
        return self[0] if self else None


class Storage:
    """A JSON file standing in for a database.

    The runtime has no `sqlite3`, and the exercise is about the ORM layer, so
    the store only has to be a persistent dict of tables to rows.
    """

    @staticmethod
    def read(path: str) -> dict:
        if not os.path.exists(path):
            return {}
        with open(path, encoding="utf-8") as handle:
            content = handle.read().strip()
        return json.loads(content) if content else {}

    @staticmethod
    def write(path: str, data: dict) -> None:
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(data, handle)


class QuerySet:
    """Lazy: filters and ordering accumulate, and nothing is read until `all()`,
    `first()`, `count()` or `get()` asks for rows."""

    def __init__(self, model, db=None, filters=None, order=None):
        self.model = model
        self.db = db
        self.filters = dict(filters or {})
        self.order = order

    def _clone(self, **changes) -> "QuerySet":
        return QuerySet(
            self.model,
            changes.get("db", self.db),
            changes.get("filters", self.filters),
            changes.get("order", self.order),
        )

    # The db path is given to whichever call comes first and carried from
    # there, which is what makes `.filter(db, ...).filter(...)` chain.
    def filter(self, *args, **kwargs) -> "QuerySet":
        db = args[0] if args else self.db
        merged = dict(self.filters)
        merged.update(kwargs)
        return self._clone(db=db, filters=merged)

    def order_by(self, *args) -> "QuerySet":
        if len(args) == 2:
            return self._clone(db=args[0], order=args[1])
        return self._clone(order=args[0])

    def _matches(self, row: dict) -> bool:
        for key, expected in self.filters.items():
            if key.endswith("__gt"):
                if not row.get(key[:-4], 0) > expected:
                    return False
            elif key.endswith("__lt"):
                if not row.get(key[:-4], 0) < expected:
                    return False
            elif key.endswith("__gte"):
                if not row.get(key[:-5], 0) >= expected:
                    return False
            elif key.endswith("__lte"):
                if not row.get(key[:-5], 0) <= expected:
                    return False
            else:
                field = self.model._fields.get(key)
                wanted = field.to_db(expected) if field else expected
                if row.get(key) != wanted:
                    return False
        return True

    def _rows(self, db=None) -> list:
        database = db or self.db
        table = Storage.read(database).get(self.model._table, [])
        rows = [row for row in table if self._matches(row)]
        if self.order:
            rows.sort(key=lambda row: row.get(self.order))
        return rows

    def all(self, db=None) -> ResultList:
        return ResultList(self.model._from_row(row) for row in self._rows(db))

    def first(self, db=None):
        return self.all(db).first()

    def count(self, db=None) -> int:
        return len(self._rows(db))

    def get(self, db=None, id=None):
        database = db or self.db
        for row in Storage.read(database).get(self.model._table, []):
            if row.get("id") == id:
                return self.model._from_row(row)
        return None


class ModelMeta(type):
    """Collects the declared fields and gives each model its own manager.

    Doing this in a metaclass is what lets a model read as a plain class body
    of field declarations, with no registration step for the author to forget.
    """

    def __new__(mcls, name, bases, namespace):
        cls = super().__new__(mcls, name, bases, namespace)
        cls._fields = {
            key: value for key, value in namespace.items() if isinstance(value, Field)
        }
        for field_name, field in cls._fields.items():
            field.name = field_name
            # The class attribute is the Field itself; clearing it means an
            # instance without a value reads as None rather than as a Field.
            setattr(cls, field_name, None)
        cls._table = name.lower()
        cls.objects = QuerySet(cls)
        return cls


class Model(metaclass=ModelMeta):
    def __init__(self, **kwargs):
        self.id = None
        self.created_at = None
        self.updated_at = None
        for name, field in self._fields.items():
            setattr(self, name, kwargs.get(name, field.default))

    @classmethod
    def create_table(cls, db) -> None:
        data = Storage.read(db)
        data[cls._table] = []
        Storage.write(db, data)

    @classmethod
    def _from_row(cls, row: dict) -> "Model":
        instance = cls()
        instance.id = row["id"]
        for name, field in cls._fields.items():
            setattr(instance, name, field.from_db(row.get(name)))
        instance.created_at = datetime.fromisoformat(row["created_at"]) if row.get("created_at") else None
        instance.updated_at = datetime.fromisoformat(row["updated_at"]) if row.get("updated_at") else None
        return instance

    def _validate(self, table: list) -> None:
        for name, field in self._fields.items():
            value = getattr(self, name)
            field.validate(value)
            if not field.unique:
                continue
            for row in table:
                if row.get(name) == field.to_db(value) and row.get("id") != self.id:
                    raise ValueError(f"{name} must be unique")

    def save(self, db) -> "Model":
        data = Storage.read(db)
        table = data.setdefault(self._table, [])

        # Validated before anything is written, so a rejected save leaves the
        # store exactly as it was.
        self._validate(table)

        now = datetime.now()
        values = {name: field.to_db(getattr(self, name)) for name, field in self._fields.items()}

        if self.id is None:
            self.id = max((row["id"] for row in table), default=0) + 1
            self.created_at = now
            self.updated_at = now
            table.append({
                "id": self.id,
                **values,
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
            })
        else:
            self.updated_at = now
            for row in table:
                if row["id"] == self.id:
                    row.update(values)
                    row["updated_at"] = now.isoformat()
                    break

        Storage.write(db, data)
        return self

    def delete(self, db) -> None:
        if self.id is None:
            return
        data = Storage.read(db)
        table = data.get(self._table, [])
        data[self._table] = [row for row in table if row["id"] != self.id]
        Storage.write(db, data)
```
