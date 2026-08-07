---
title: "Object-Oriented Python"
slug: "python-object-oriented-python"
description: "Classes, inheritance, properties, and dunder methods, including the shared-state bug that class attributes create and dataclasses only half-fix."
track: "python"
order: 3
difficulty: "intermediate"
tags: ["classes", "oop", "inheritance", "dataclasses", "properties", "abstract-classes"]
practice:
  concept: "object-oriented-python"
  label: "Object-oriented Python"
---

A class bundles data and behavior, and Python's version of it is pragmatic
rather than dogmatic — there's no `private` keyword, no interface keyword,
and no requirement that every object come from a class hierarchy at all.
What it does have is a specific set of rules for how attributes are looked
up and shared, and getting those rules wrong produces bugs that look like
they couldn't possibly be about classes.

## Classes and Shared State

`__init__` is the constructor, called automatically when you create an
instance. Every instance method takes `self` first, referring to the
specific instance the method was called on.

```python
class BankAccount:
    def __init__(self, owner, balance=0):
        self.owner = owner
        self.balance = balance

    def deposit(self, amount):
        if amount <= 0:
            raise ValueError("deposit must be positive")
        self.balance += amount

    def __str__(self):
        return f"BankAccount({self.owner}, balance={self.balance})"

account = BankAccount("Alice", 100)
account.deposit(50)
print(account)   # BankAccount(Alice, balance=150)
```

Here is the class-level version of a bug most people already know from
function defaults. An attribute assigned directly in the class body, not
inside `__init__`, is created **once**, when the class is defined — and
every instance that doesn't set its own copy shares that one object.

```python
class Player:
    inventory = []          # one list, owned by the class

    def __init__(self, name):
        self.name = name

p1, p2 = Player("Aya"), Player("Bo")
p1.inventory.append("sword")
print(p2.inventory)   # ['sword'] — p2 never touched it
```

`p1.inventory` and `p2.inventory` both resolve to the class attribute
because neither instance has its own `inventory` in `self.__dict__` yet —
attribute lookup checks the instance first, then falls back to the class.
The fix is the same shape as the mutable-default fix: build the mutable
value inside `__init__`.

```python
class Player:
    def __init__(self, name):
        self.name = name
        self.inventory = []   # now every instance owns its own list
```

## Methods and Properties

Python gives you three kinds of methods on a class.

```python
class Temperature:
    def __init__(self, celsius):
        self.celsius = celsius

    def to_fahrenheit(self):                      # operates on this instance
        return self.celsius * 9 / 5 + 32

    @classmethod
    def from_fahrenheit(cls, fahrenheit):          # alternative constructor
        return cls((fahrenheit - 32) * 5 / 9)

    @staticmethod
    def is_boiling(celsius):                       # doesn't need self or cls
        return celsius >= 100

t = Temperature.from_fahrenheit(212)
print(t.celsius, t.to_fahrenheit())   # 100.0 212.0
```

`@classmethod` is how you write a second constructor without repeating the
class name — `cls` is whichever class the method was actually called on,
which matters once subclasses exist. `@staticmethod` is a plain function
that happens to live in the class's namespace for organization; reach for
it when the logic belongs conceptually to the class but doesn't touch any
instance or class state.

::code-blank{lang="python" href="/tracks/python/object-oriented-python" label="practice object-oriented python for real"}
---
code: |
  class Temperature:
      def __init__(self, celsius):
          self.celsius = celsius

      @___blank_start___classmethod___blank_end___
      def from_fahrenheit(cls, fahrenheit):
          return cls((fahrenheit - 32) * 5 / 9)
---
::

A property lets an attribute look like a plain attribute from the outside
while running code on access.

```python
class Circle:
    def __init__(self, radius):
        self._radius = radius

    @property
    def radius(self):
        return self._radius

    @radius.setter
    def radius(self, value):
        if value < 0:
            raise ValueError("radius cannot be negative")
        self._radius = value

c = Circle(5)
c.radius = 10   # runs the setter's validation, not a plain assignment
```

Start every attribute as a plain one. Add a property only when you need to
validate on write or compute on read — converting later doesn't break
callers, because `c.radius = 10` reads the same either way.

::code-blank{lang="python" href="/tracks/python/object-oriented-python" label="practice object-oriented python for real"}
---
code: |
  class Circle:
      def __init__(self, radius):
          self._radius = radius

      @property
      def radius(self):
          return self._radius

      @radius.___blank_start___setter___blank_end___
      def radius(self, value):
          self._radius = value
---
::

## Inheritance and `super()`

```python
class Animal:
    def __init__(self, name, sound):
        self.name = name
        self.sound = sound

    def speak(self):
        return f"{self.name} says {self.sound}!"

class Dog(Animal):
    def __init__(self, name, breed):
        super().__init__(name, sound="Woof")
        self.breed = breed

dog = Dog("Rex", "Labrador")
print(dog.speak())   # Rex says Woof!
```

`super()` doesn't mean "my parent class" — it means "the next class in the
method resolution order," which is the same thing in single inheritance and
a genuinely different thing once a class inherits from more than one base.
For single inheritance, which covers most Python code, read it as "call the
parent's version of this method" and move on.

## Dunder Methods

Dunder methods define how instances respond to built-in operations —
printing, equality, arithmetic.

```python
class Vector:
    def __init__(self, x, y):
        self.x, self.y = x, y

    def __repr__(self):
        return f"Vector({self.x}, {self.y})"

    def __eq__(self, other):
        if not isinstance(other, Vector):
            return NotImplemented
        return self.x == other.x and self.y == other.y

    def __add__(self, other):
        return Vector(self.x + other.x, self.y + other.y)

v1, v2 = Vector(3, 4), Vector(1, 2)
print(v1 + v2)              # Vector(4, 6)
print(v1 == Vector(3, 4))   # True
```

Defining `__eq__` makes the class unhashable by default — Python won't let
you put it in a set or use it as a dict key, because it can no longer
guarantee that equal objects hash the same way unless you tell it how. If
you need both, hash the same fields you compare:

```python
def __hash__(self):
    return hash((self.x, self.y))
```

::code-blank{lang="python" href="/tracks/python/object-oriented-python" label="practice object-oriented python for real"}
---
code: |
  class Vector:
      def __init__(self, x, y):
          self.x, self.y = x, y

      def __eq__(self, other):
          return isinstance(other, Vector) and self.x == other.x and self.y == other.y

      def _____blank_start___hash___blank_end___(self):
          return hash((self.x, self.y))
---
::

## Dataclasses

`@dataclass` generates `__init__`, `__repr__`, and `__eq__` for classes that
are primarily data.

```python
from dataclasses import dataclass, field

@dataclass
class Product:
    name: str
    price: float
    tags: list[str] = field(default_factory=list)

    @property
    def display_price(self):
        return f"${self.price:.2f}"

apple = Product("Apple", 1.50, tags=["fruit"])
print(apple)   # Product(name='Apple', price=1.5, tags=['fruit'])
```

`field(default_factory=list)` exists for exactly the shared-mutable-state
problem from the first section — `tags: list[str] = []` doesn't just risk
the bug, `@dataclass` refuses to compile it and raises `ValueError` at class
definition time rather than let it happen silently later. `default_factory`
gives each instance a fresh call to `list()` instead of one shared object.
Add `@dataclass(frozen=True)` when you want the instances themselves to be
immutable, which is useful for value objects and dict keys.

## Abstract Base Classes

An ABC defines methods subclasses are required to implement; instantiating
a subclass that skips one raises `TypeError` immediately, rather than an
`AttributeError` the first time something calls the missing method.

```python
from abc import ABC, abstractmethod

class Shape(ABC):
    @abstractmethod
    def area(self) -> float: ...

class Rectangle(Shape):
    def __init__(self, width, height):
        self.width, self.height = width, height

    def area(self):
        return self.width * self.height

rect = Rectangle(5, 3)
print(rect.area())   # 15
```

Reach for an ABC when you're defining a family of classes you control and
want the interface enforced at instantiation. When you only care that an
object *behaves* like it has a method — no shared base class required — use
`typing.Protocol` instead; it checks structurally and doesn't force
unrelated classes into an inheritance relationship they don't need.

## Where This Bites

**A mutable class attribute is one object, shared by every instance that
hasn't shadowed it.** It reads exactly like a per-instance default and
behaves nothing like one. Initialize mutable state inside `__init__`, not
as a bare assignment in the class body.

**Defining `__eq__` without `__hash__` makes instances silently
unhashable.** The class still works fine until the first time someone puts
an instance in a set or uses it as a dict key, and then it fails with
`TypeError: unhashable type` far from wherever `__eq__` was written.

**A subclass `__init__` that forgets `super().__init__()` never initializes
the parent's attributes.** The object builds without error and fails later,
at first use, with an `AttributeError` that points at the wrong class
entirely.

**`tags: list[str] = []` in a dataclass field is not a default, it's a
`ValueError` at class definition.** `@dataclass` catches the
mutable-default case explicitly rather than let it become a runtime bug —
use `field(default_factory=list)`.
