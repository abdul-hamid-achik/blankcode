---
slug: rust-structs-enums-and-pattern-matching-traffic-light
title: Traffic Light State Machine
description: Create a traffic light system using enums and pattern matching to handle different light states and transitions.
difficulty: intermediate
hints:
  - Use an enum to represent the three possible traffic light colors
  - Pattern matching with 'match' allows you to handle each enum variant
  - Methods on enums are defined using 'impl' blocks
  - "The next state follows the cycle: Green -> Yellow -> Red -> Green"
tags:
  - rust
  - enums
  - pattern-matching
  - methods
---

In this exercise, you'll build a simple traffic light system using Rust's enums and pattern matching. You'll create a `TrafficLight` enum with three states and implement a method to transition between states.

Your tasks:
1. Define a `TrafficLight` enum with variants for Red, Yellow, and Green
2. Implement a `next()` method that returns the next state in the cycle
3. Implement a `duration()` method that returns how long (in seconds) each light should stay on
4. Use pattern matching to handle each state appropriately

```rust
// Define the TrafficLight enum with three variants
___blank_start___enum TrafficLight___blank_end___ {
    Red,
    Yellow,
    Green,
}

impl TrafficLight {
    // Return the next state in the traffic light cycle
    fn next(&self) -> TrafficLight {
        match self {
            TrafficLight::Red => ___blank_start___TrafficLight::Green___blank_end___,
            TrafficLight::Green => ___blank_start___TrafficLight::Yellow___blank_end___,
            TrafficLight::Yellow => ___blank_start___TrafficLight::Red___blank_end___,
        }
    }
    
    // Return the duration in seconds for each light state
    fn duration(&self) -> u32 {
        match self {
            TrafficLight::Red => ___blank_start___60___blank_end___,
            TrafficLight::Yellow => ___blank_start___10___blank_end___,
            TrafficLight::Green => ___blank_start___45___blank_end___,
        }
    }
    
    // Return a string description of the current state
    fn describe(&self) -> String {
        match self {
            TrafficLight::Red => ___blank_start___String::from("Stop! The light is red.")___blank_end___,
            TrafficLight::Yellow => ___blank_start___String::from("Caution! The light is yellow.")___blank_end___,
            TrafficLight::Green => ___blank_start___String::from("Go! The light is green.")___blank_end___,
        }
    }
}
```

## Tests

```rust
#[test]
fn traffic_light_cycle() {
    let red = TrafficLight::Red;
    let green = red.next();
    let yellow = green.next();
    let back_to_red = yellow.next();
    assert!(matches!(green, TrafficLight::Green));
    assert!(matches!(yellow, TrafficLight::Yellow));
    assert!(matches!(back_to_red, TrafficLight::Red));
}

#[test]
fn traffic_light_durations() {
    assert_eq!(TrafficLight::Red.duration(), 60);
    assert_eq!(TrafficLight::Yellow.duration(), 10);
    assert_eq!(TrafficLight::Green.duration(), 45);
}

#[test]
fn traffic_light_descriptions() {
    assert_eq!(TrafficLight::Red.describe(), "Stop! The light is red.");
    assert_eq!(TrafficLight::Yellow.describe(), "Caution! The light is yellow.");
    assert_eq!(TrafficLight::Green.describe(), "Go! The light is green.");
}
```
