---
title: "Object-Oriented Python"
slug: "python-object-oriented-python"
description: "Learn classes, inheritance, properties, dunder methods, and dataclasses in Python"
track: "python"
order: 3
difficulty: "intermediate"
tags: ["classes", "oop", "inheritance", "dataclasses", "properties", "abstract-classes"]
---

# Object-Oriented Python

Object-oriented programming (OOP) lets you model real-world concepts as classes and objects. Python's OOP support is flexible and pragmatic, giving you powerful tools without forcing rigid patterns.

## Classes and `__init__`

A class bundles data (attributes) and behavior (methods) together. The `__init__` method is the constructor, called automatically when you create an instance.

```python
class BankAccount:
    def __init__(self, owner, balance=0):
        self.owner = owner
        self.balance = balance

    def deposit(self, amount):
        if amount <= 0:
            raise ValueError("Deposit amount must be positive")
        self.balance += amount

    def withdraw(self, amount):
        if amount > self.balance:
            raise ValueError("Insufficient funds")
        self.balance -= amount

    def __str__(self):
        return f"BankAccount({self.owner}, balance={self.balance})"


account = BankAccount("Alice", 100)
account.deposit(50)
account.withdraw(30)
print(account)  # BankAccount(Alice, balance=120)
```

Every instance method takes `self` as its first parameter, which refers to the specific instance the method is called on.

## Instance Methods, Class Methods, and Static Methods

Python provides three kinds of methods on a class.

```python
class Temperature:
    def __init__(self, celsius):
        self.celsius = celsius

    # instance method: operates on a specific instance
    def to_fahrenheit(self):
        return self.celsius * 9 / 5 + 32

    # class method: operates on the class itself, often used as alternative constructors
    @classmethod
    def from_fahrenheit(cls, fahrenheit):
        return cls((fahrenheit - 32) * 5 / 9)

    # static method: utility that belongs to the class namespace
    @staticmethod
    def is_boiling(celsius):
        return celsius >= 100


t = Temperature.from_fahrenheit(212)
print(t.celsius)           # 100.0
print(t.to_fahrenheit())   # 212.0
print(Temperature.is_boiling(100))  # True
```

## Properties

Properties let you control attribute access with getter, setter, and deleter methods while keeping a clean interface for callers.

```python
import math

class Circle:
    def __init__(self, radius):
        self._radius = radius

    @property
    def radius(self):
        return self._radius

    @radius.setter
    def radius(self, value):
        if value < 0:
            raise ValueError("Radius cannot be negative")
        self._radius = value

    @property
    def area(self):
        return math.pi * self._radius ** 2


c = Circle(5)
print(c.radius)    # 5
print(f"{c.area:.2f}")  # 78.54

c.radius = 10
print(f"{c.area:.2f}")  # 314.16
```

## Inheritance and `super()`

Inheritance lets a child class reuse and extend parent behavior. Use `super()` to call the parent's methods.

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

    def fetch(self, item):
        return f"{self.name} fetches the {item}!"


class Cat(Animal):
    def __init__(self, name):
        super().__init__(name, sound="Meow")

    def purr(self):
        return f"{self.name} purrs softly."


dog = Dog("Rex", "Labrador")
cat = Cat("Whiskers")

print(dog.speak())        # Rex says Woof!
print(dog.fetch("ball"))  # Rex fetches the ball!
print(cat.purr())         # Whiskers purrs softly.
```

## Dunder Methods

Dunder (double underscore) methods let you define how your objects interact with built-in operations like printing, comparison, and arithmetic.

```python
class Vector:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __repr__(self):
        return f"Vector({self.x}, {self.y})"

    def __str__(self):
        return f"({self.x}, {self.y})"

    def __eq__(self, other):
        if not isinstance(other, Vector):
            return NotImplemented
        return self.x == other.x and self.y == other.y

    def __add__(self, other):
        if not isinstance(other, Vector):
            return NotImplemented
        return Vector(self.x + other.x, self.y + other.y)

    def __abs__(self):
        return (self.x ** 2 + self.y ** 2) ** 0.5

    def __bool__(self):
        return self.x != 0 or self.y != 0


v1 = Vector(3, 4)
v2 = Vector(1, 2)

print(repr(v1))        # Vector(3, 4)
print(v1 + v2)         # (4, 6)
print(abs(v1))         # 5.0
print(v1 == Vector(3, 4))  # True
print(bool(Vector(0, 0)))  # False
```

Note: defining `__eq__` makes the class unhashable by default. If you need to use instances as dictionary keys or in sets, you must also define `__hash__`. A common approach is to hash a tuple of the fields used in `__eq__`:

```python
def __hash__(self):
    return hash((self.x, self.y))
```

## Dataclasses

The `dataclasses` module, introduced in Python 3.7, eliminates boilerplate for classes that are primarily data containers. It auto-generates `__init__`, `__repr__`, `__eq__`, and more.

```python
from __future__ import annotations
from dataclasses import dataclass, field

@dataclass
class Product:
    name: str
    price: float
    tags: list[str] = field(default_factory=list)
    in_stock: bool = True

    @property
    def display_price(self):
        return f"${self.price:.2f}"


apple = Product("Apple", 1.50, tags=["fruit", "organic"])
banana = Product("Banana", 0.75)

print(apple)
# Product(name='Apple', price=1.5, tags=['fruit', 'organic'], in_stock=True)
print(apple.display_price)  # $1.50
print(apple == Product("Apple", 1.50, tags=["fruit", "organic"]))  # True
```

Note: the `list[str]` syntax in annotations requires Python 3.9+. The `from __future__ import annotations` import at the top makes it work on Python 3.7+ by deferring annotation evaluation.

Use `field(default_factory=list)` for mutable defaults. Without it, all instances would share the same list object.

You can also use `@dataclass(frozen=True)` to make instances immutable, which is useful for value objects and dictionary keys.

## Abstract Base Classes

Abstract base classes (ABCs) define an interface that subclasses must implement. Any class inheriting from an ABC without implementing all abstract methods raises `TypeError` at instantiation.

```python
from abc import ABC, abstractmethod

class Shape(ABC):
    @abstractmethod
    def area(self) -> float: ...

    @abstractmethod
    def perimeter(self) -> float: ...

class Rectangle(Shape):
    def __init__(self, width, height):
        self.width = width
        self.height = height

    def area(self):
        return self.width * self.height

    def perimeter(self):
        return 2 * (self.width + self.height)

rect = Rectangle(5, 3)
print(rect.area())       # 15
print(rect.perimeter())  # 16
```

## What's Next?

Now that you understand classes, inheritance, and Python's data model, you are ready to tackle decorators, generators, and type hints in the advanced tutorial. Practice building classes on [the Python track](/tracks/python).

Next up: [Advanced Python](/tutorials/python-advanced)
