---
slug: rust-structs-enums-and-pattern-matching-inventory-system
title: Building a Game Inventory System
description: Learn to use structs, enums, and pattern matching to create a simple inventory system for a game character.
difficulty: intermediate
hints:
  - Enums are perfect for representing a fixed set of item types
  - Use pattern matching with 'match' to handle different enum variants
  - Struct methods are defined in an 'impl' block
  - The match expression must cover all possible enum variants
tags:
  - structs
  - enums
  - pattern-matching
  - methods
---

In this exercise, you'll build a simple inventory system for a game character. You'll define an enum to represent different item types, a struct to represent the inventory, and use pattern matching to implement item-related logic.

Your tasks:
1. Complete the `ItemType` enum with variants for Weapon, Potion, and Armor
2. Implement the `describe` method using pattern matching to return appropriate descriptions
3. Complete the `add_item` method to add items to the inventory
4. Implement the `count_items_of_type` method using pattern matching

```rust
// Define an enum for different item types
___blank_start___enum ItemType___blank_end___ {
    Weapon,
    Potion,
    Armor,
}

struct Item {
    name: String,
    item_type: ItemType,
}

struct Inventory {
    items: Vec<Item>,
}

impl Item {
    fn new(name: &str, item_type: ItemType) -> Self {
        Item {
            name: name.to_string(),
            item_type,
        }
    }

    // Return a description based on the item type using pattern matching
    fn describe(&self) -> String {
        match self.item_type {
            ItemType::Weapon => ___blank_start___format!("{} is a weapon for combat", self.name)___blank_end___,
            ItemType::Potion => ___blank_start___format!("{} is a potion for healing", self.name)___blank_end___,
            ItemType::Armor => ___blank_start___format!("{} is armor for protection", self.name)___blank_end___,
        }
    }
}

impl Inventory {
    fn new() -> Self {
        Inventory { items: Vec::new() }
    }

    // Add an item to the inventory
    fn add_item(&mut self, item: Item) {
        ___blank_start___self.items.push(item);___blank_end___
    }

    // Count how many items of a specific type are in the inventory
    fn count_items_of_type(&self, item_type: ItemType) -> usize {
        let mut count = 0;
        for item in &self.items {
            match (&item.item_type, &item_type) {
                ___blank_start___(ItemType::Weapon, ItemType::Weapon)___blank_end___ => count += 1,
                ___blank_start___(ItemType::Potion, ItemType::Potion)___blank_end___ => count += 1,
                ___blank_start___(ItemType::Armor, ItemType::Armor)___blank_end___ => count += 1,
                _ => {}
            }
        }
        count
    }
}

fn main() {
    let mut inventory = Inventory::new();
    
    inventory.add_item(Item::new("Iron Sword", ItemType::Weapon));
    inventory.add_item(Item::new("Health Potion", ItemType::Potion));
    inventory.add_item(Item::new("Steel Shield", ItemType::Armor));
    inventory.add_item(Item::new("Mana Potion", ItemType::Potion));
    
    println!("Total weapons: {}", inventory.count_items_of_type(ItemType::Weapon));
    println!("Total potions: {}", inventory.count_items_of_type(ItemType::Potion));
}
```

## Tests

```rust
#[test]
fn item_descriptions() {
    let weapon = Item::new("Sword", ItemType::Weapon);
    let potion = Item::new("Healing", ItemType::Potion);
    let armor = Item::new("Plate", ItemType::Armor);
    assert_eq!(weapon.describe(), "Sword is a weapon for combat");
    assert_eq!(potion.describe(), "Healing is a potion for healing");
    assert_eq!(armor.describe(), "Plate is armor for protection");
}

#[test]
fn inventory_counts_items() {
    let mut inventory = Inventory::new();
    inventory.add_item(Item::new("Sword", ItemType::Weapon));
    inventory.add_item(Item::new("Axe", ItemType::Weapon));
    inventory.add_item(Item::new("Potion", ItemType::Potion));
    inventory.add_item(Item::new("Shield", ItemType::Armor));
    inventory.add_item(Item::new("Helmet", ItemType::Armor));
    inventory.add_item(Item::new("Boots", ItemType::Armor));
    assert_eq!(inventory.count_items_of_type(ItemType::Weapon), 2);
    assert_eq!(inventory.count_items_of_type(ItemType::Potion), 1);
    assert_eq!(inventory.count_items_of_type(ItemType::Armor), 3);
}

#[test]
fn empty_inventory_counts_zero() {
    let inventory = Inventory::new();
    assert_eq!(inventory.count_items_of_type(ItemType::Weapon), 0);
}
```
