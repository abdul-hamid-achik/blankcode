---
slug: python-object-oriented-python-pet-class
title: Create a Simple Pet Class
description: Learn to create a basic class in Python with attributes and methods by building a Pet class that stores information about a pet and allows it to make sounds.
difficulty: beginner
hints:
  - Classes are defined using the `class` keyword followed by the class name
  - The `__init__` method is the constructor that initializes object attributes
  - The `self` parameter refers to the instance of the class itself
  - Instance methods need `self` as their first parameter to access object attributes
tags:
  - object-oriented-programming
  - classes
  - methods
  - constructors
---

Create a `Pet` class that represents a pet with a name and species. The class should have:
1. An `__init__` constructor that takes `name` and `species` as parameters
2. A `speak` method that returns a string with the pet's name and a sound
3. A `get_info` method that returns a formatted string with the pet's details

Fill in the blanks to complete the class definition.

```python
___blank_start___class___blank_end___ Pet:
    def ___blank_start_____init____blank_end___(self, name, species):
        ___blank_start___self.name___blank_end___ = name
        ___blank_start___self.species___blank_end___ = species
    
    def speak(self, sound):
        return f"{self.name} says {sound}!"
    
    def get_info(self):
        return f"{self.name} is a {self.species}"

# Test your code
my_pet = Pet("Buddy", "dog")
print(my_pet.speak("woof"))
print(my_pet.get_info())
```

## Tests

```python


def test_pet_class_basics():
    pet = Pet("Buddy", "dog")
    assert pet.name == "Buddy"
    assert pet.species == "dog"
    assert pet.speak("woof") == "Buddy says woof!"
    assert pet.get_info() == "Buddy is a dog"
```
