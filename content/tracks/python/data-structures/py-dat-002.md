---
slug: python-datastructures-shopping-list
title: Managing a Shopping List with Lists and Dictionaries
description: Learn to work with Python lists and dictionaries by creating and manipulating a shopping list with items and quantities.
difficulty: beginner
hints:
  - Lists use square brackets [] and can be modified with .append()
  - Dictionaries use curly braces {} and store key-value pairs
  - Access dictionary values using square brackets with the key name
  - The len() function returns the number of items in a collection
tags:
  - data-structures
  - lists
  - dictionaries
  - beginner
---

In this exercise, you'll practice working with Python's fundamental data structures: lists and dictionaries. You'll create a shopping list that stores both item names and their quantities.

Complete the code to:
1. Create a list of shopping items
2. Create a dictionary to store item quantities
3. Add a new item to the shopping list
4. Calculate the total number of items needed

```python
def manage_shopping_list():
    # Create a list with three initial shopping items
    shopping_items = ___blank_start___["milk", "eggs", "bread"]___blank_end___
    
    # Create a dictionary to track quantities for each item
    # milk: 2, eggs: 12, bread: 1
    item_quantities = ___blank_start___{"milk": 2, "eggs": 12, "bread": 1}___blank_end___
    
    # Add a new item "apples" to the shopping list
    shopping_items.___blank_start___append("apples")___blank_end___
    
    # Add the quantity for apples (5) to the dictionary
    item_quantities["apples"] = 5
    
    # Calculate total items by summing all quantities
    total_items = ___blank_start___sum(item_quantities.values())___blank_end___
    
    return shopping_items, item_quantities, total_items
```

## Tests

```python


def test_manage_shopping_list():
    items, quantities, total_items = manage_shopping_list()
    assert items[:3] == ["milk", "eggs", "bread"]
    assert "apples" in items
    assert len(items) == 4
    assert quantities["milk"] == 2
    assert quantities["eggs"] == 12
    assert quantities["bread"] == 1
    assert quantities["apples"] == 5
    assert total_items == 20
```
