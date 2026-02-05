---
slug: go-structs-and-interfaces-shape-calculator
title: Shape Area Calculator with Interfaces
description: Create a shape calculator using structs and interfaces to calculate areas of different geometric shapes.
difficulty: beginner
hints:
  - Interfaces in Go define a set of method signatures that a type must implement
  - Any type that implements all methods of an interface automatically satisfies that interface
  - Structs can have methods by defining functions with a receiver
  - Method receivers are specified between 'func' and the method name
tags:
  - structs
  - interfaces
  - methods
  - polymorphism
---

In this exercise, you'll learn how to use structs and interfaces in Go to create a flexible shape calculator. You'll define a `Shape` interface and implement it for different geometric shapes.

Your task is to:
1. Define a `Shape` interface with an `Area()` method
2. Create a `Rectangle` struct and implement the `Shape` interface
3. Create a `Circle` struct and implement the `Shape` interface
4. Write a function that accepts any `Shape` and returns its area

```go
package main

import "math"

// Define a Shape interface with an Area method that returns float64
type ___blank_start___Shape___blank_end___ interface {
	Area() float64
}

// Define a Rectangle struct with width and height fields
type Rectangle struct {
	width  float64
	height float64
}

// Implement the Area method for Rectangle
func (r ___blank_start___Rectangle___blank_end___) Area() float64 {
	return r.width * r.height
}

// Define a Circle struct with radius field
type Circle struct {
	radius float64
}

// Implement the Area method for Circle
func (c Circle) ___blank_start___Area___blank_end___() float64 {
	return math.Pi * c.radius * c.radius
}

// Function that calculates area for any Shape
func CalculateArea(s ___blank_start___Shape___blank_end___) float64 {
	return s.Area()
}
```

## Tests

```go
package main

import "testing"

func TestRectangleArea(t *testing.T) {
rect := Rectangle{width: 5.0, height: 4.0}
if rect.Area() != 20.0 {
t.Fatalf("expected rectangle area 20.0, got %.1f", rect.Area())
}
}

func TestCircleArea(t *testing.T) {
circle := Circle{radius: 3.0}
const expected = 28.27
actual := float64(int(circle.Area()*100)) / 100
if actual != expected {
t.Fatalf("expected circle area %.2f, got %.2f", expected, actual)
}
}

func TestCalculateArea(t *testing.T) {
rect := Rectangle{width: 10.0, height: 2.0}
circle := Circle{radius: 5.0}
if CalculateArea(rect) != 20.0 {
t.Fatalf("expected rectangle area 20.0")
}
actual := float64(int(CalculateArea(circle)*100)) / 100
if actual != 78.54 {
t.Fatalf("expected circle area 78.54, got %.2f", actual)
}
}

func TestShapeInterface(t *testing.T) {
var _ Shape = Rectangle{}
var _ Shape = Circle{}
}
```
