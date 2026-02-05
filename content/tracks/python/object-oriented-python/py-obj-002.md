---
slug: python-object-oriented-python-pet-class
title: Creating a Simple Pet Class
description: Learn the basics of object-oriented programming in Python by creating a Pet class with attributes and methods.
difficulty: beginner
hints:
  - Use __init__ to define the constructor method
  - The first parameter of instance methods should be 'self'
  - Access instance attributes using self.attribute_name
  - Methods can modify instance attributes by reassigning self.attribute_name
tags:
  - python
  - oop
  - classes
  - methods
---

In this exercise, you'll create a `Pet` class that represents a pet with a name, species, and energy level. You'll implement:

1. A constructor to initialize the pet's attributes
2. A method to make the pet play (which decreases energy)
3. A method to make the pet sleep (which restores energy)

Complete the blanks to make the Pet class work correctly.

```python
class Pet:
    def ___blank_start_____init____blank_end___(self, name, species):
        """Initialize a new pet with a name, species, and full energy."""
        self.name = name
        self.species = species
        self.energy = 100
    
    def play(self):
        """Make the pet play, decreasing energy by 20."""
        ___blank_start___self.energy___blank_end___ -= 20
        if self.energy < 0:
            self.energy = 0
        return f"{self.name} is playing! Energy: {self.energy}"
    
    def sleep(___blank_start___self___blank_end___):
        """Make the pet sleep, restoring energy to 100."""
        ___blank_start___self.energy___blank_end___ = 100
        return f"{self.name} is sleeping. Energy restored!"
```

## Tests

```python


def test_pet_energy_play_sleep():
    pet = Pet("Fluffy", "cat")
    assert pet.energy == 100
    pet.play()
    assert pet.energy == 80
    pet.play()
    assert pet.energy == 60
    pet.sleep()
    assert pet.energy == 100
```
