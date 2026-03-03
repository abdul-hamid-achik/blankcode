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

Write your complete implementation below:

```python
from datetime import datetime
from typing import Any, Optional, List, Dict, Type

# Your implementation here
```

## Tests

```python
import pytest
import os

@pytest.fixture
def test_db():
    # Setup test database
    db_path = 'test_orm.db'
    yield db_path
    os.unlink(db_path)

def test_model_creation(test_db):
    class User(Model):
        name = StringField(max_length=100)
        email = StringField()
    
    User.create_table(test_db)
    user = User(name="John", email="john@example.com")
    user.save(test_db)
    
    assert user.id is not None
    assert user.name == "John"

def test_model_save_and_retrieve(test_db):
    class User(Model):
        name = StringField(max_length=100)
        email = StringField()
    
    User.create_table(test_db)
    user = User(name="John", email="john@example.com")
    user.save(test_db)
    
    retrieved = User.objects.get(test_db, user.id)
    assert retrieved.name == "John"
    assert retrieved.email == "john@example.com"

def test_model_update(test_db):
    class User(Model):
        name = StringField(max_length=100)
        email = StringField()
    
    User.create_table(test_db)
    user = User(name="John", email="john@example.com")
    user.save(test_db)
    
    user.name = "Jane"
    user.save(test_db)
    
    retrieved = User.objects.get(test_db, user.id)
    assert retrieved.name == "Jane"

def test_model_delete(test_db):
    class User(Model):
        name = StringField(max_length=100)
    
    User.create_table(test_db)
    user = User(name="John")
    user.save(test_db)
    
    user.delete(test_db)
    
    retrieved = User.objects.get(test_db, user.id)
    assert retrieved is None

def test_queryset_filter(test_db):
    class User(Model):
        name = StringField(max_length=100)
        age = IntegerField()
    
    User.create_table(test_db)
    User(name="John", age=25).save(test_db)
    User(name="Jane", age=30).save(test_db)
    User(name="Bob", age=25).save(test_db)
    
    users = User.objects.filter(test_db, age=25).all()
    assert len(users) == 2

def test_queryset_filter_greater_than(test_db):
    class User(Model):
        name = StringField(max_length=100)
        age = IntegerField()
    
    User.create_table(test_db)
    User(name="John", age=25).save(test_db)
    User(name="Jane", age=30).save(test_db)
    User(name="Bob", age=35).save(test_db)
    
    users = User.objects.filter(test_db, age__gt=25).all()
    assert len(users) == 2

def test_queryset_filter_less_than(test_db):
    class User(Model):
        name = StringField(max_length=100)
        age = IntegerField()
    
    User.create_table(test_db)
    User(name="John", age=25).save(test_db)
    User(name="Jane", age=30).save(test_db)
    User(name="Bob", age=35).save(test_db)
    
    users = User.objects.filter(test_db, age__lt=30).all()
    assert len(users) == 1

def test_queryset_first(test_db):
    class User(Model):
        name = StringField(max_length=100)
    
    User.create_table(test_db)
    User(name="John").save(test_db)
    User(name="Jane").save(test_db)
    
    first = User.objects.all(test_db).first()
    assert first.name == "John"

def test_queryset_chain_filters(test_db):
    class User(Model):
        name = StringField(max_length=100)
        age = IntegerField()
        active = BooleanField(default=True)
    
    User.create_table(test_db)
    User(name="John", age=25, active=True).save(test_db)
    User(name="Jane", age=30, active=True).save(test_db)
    User(name="Bob", age=25, active=False).save(test_db)
    
    users = User.objects.filter(test_db, age=25).filter(active=True).all()
    assert len(users) == 1
    assert users[0].name == "John"

def test_model_validation(test_db):
    class User(Model):
        name = StringField(max_length=5)
    
    User.create_table(test_db)
    user = User(name="VeryLongName")
    
    with pytest.raises(ValueError):
        user.save(test_db)

def test_unique_field(test_db):
    class User(Model):
        email = StringField(unique=True)
    
    User.create_table(test_db)
    User(email="john@example.com").save(test_db)
    
    with pytest.raises(ValueError):
        User(email="john@example.com").save(test_db)

def test_auto_timestamps(test_db):
    class User(Model):
        name = StringField(max_length=100)
    
    User.create_table(test_db)
    before = datetime.now()
    user = User(name="John")
    user.save(test_db)
    after = datetime.now()
    
    assert before <= user.created_at <= after
    assert before <= user.updated_at <= after

def test_queryset_count(test_db):
    class User(Model):
        name = StringField(max_length=100)
    
    User.create_table(test_db)
    User(name="John").save(test_db)
    User(name="Jane").save(test_db)
    
    count = User.objects.count(test_db)
    assert count == 2

def test_queryset_order_by(test_db):
    class User(Model):
        name = StringField(max_length=100)
        age = IntegerField()
    
    User.create_table(test_db)
    User(name="John", age=30).save(test_db)
    User(name="Jane", age=25).save(test_db)
    User(name="Bob", age=35).save(test_db)
    
    users = User.objects.order_by(test_db, 'age').all()
    assert users[0].age == 25
    assert users[1].age == 30
    assert users[2].age == 35
```
