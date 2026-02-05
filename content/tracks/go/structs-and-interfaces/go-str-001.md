---
slug: go-structs-and-interfaces-shape-calculator
title: Shape Area Calculator with Interfaces
description: Learn how to define structs and interfaces in Go by implementing a shape area calculator that works with different geometric shapes.
difficulty: beginner
hints:
  - Interfaces in Go define a set of method signatures that a type must implement
  - Any type that implements all methods of an interface automatically satisfies that interface
  - Structs can have methods attached to them using receiver syntax
  - Method receivers are defined between 'func' and the method name
tags:
  - structs
  - interfaces
  - methods
  - polymorphism
---

In this exercise, you'll create a simple shape calculator that demonstrates Go's interface system. You'll define a `Shape` interface and implement it for different geometric shapes.

Your task is to:
1. Define a `Shape` interface with an `Area()` method
2. Create a `Rectangle` struct with width and height fields
3. Implement the `Area()` method for Rectangle
4. Create a method that accepts any Shape and calculates its area

```go
package main

import "math"

// Define the Shape interface with an Area method that returns a float64
type ___blank_start___Shape___blank_end___ interface {
	___blank_start___Area() float64___blank_end___
}

// Rectangle struct with Width and Height fields
type Rectangle struct {
	Width  float64
	Height float64
}

// Circle struct with Radius field
type Circle struct {
	Radius float64
}

// Implement Area method for Rectangle
// The receiver should be of type Rectangle
func (r ___blank_start___Rectangle___blank_end___) Area() float64 {
	return r.Width * r.Height
}

// Implement Area method for Circle
func (c Circle) Area() float64 {
	return math.Pi * c.Radius * c.Radius
}

// CalculateTotalArea accepts a slice of Shape and returns total area
// Use the Shape interface type for the parameter
func CalculateTotalArea(shapes []___blank_start___Shape___blank_end___) float64 {
	total := 0.0
	for _, shape := range shapes {
		total += shape.Area()
	}
	return total
}
```

## Tests

```go
package main

import "testing"

func TestRectangleArea(t *testing.T) {
	rect := Rectangle{Width: 5, Height: 3}
	if rect.Area() != 15 {
		t.Fatalf("expected rectangle area 15, got %.1f", rect.Area())
	}
}

func TestCircleArea(t *testing.T) {
	circle := Circle{Radius: 2}
	const expected = 12.57
	actual := float64(int(circle.Area()*100)) / 100
	if actual != expected {
		t.Fatalf("expected circle area %.2f, got %.2f", expected, actual)
	}
}

func TestCalculateTotalArea(t *testing.T) {
	shapes := []Shape{
		Rectangle{Width: 4, Height: 5},
		Circle{Radius: 3},
	}
	const expected = 48.27
	actual := float64(int(CalculateTotalArea(shapes)*100)) / 100
	if actual != expected {
		t.Fatalf("expected total area %.2f, got %.2f", expected, actual)
	}
}

func TestShapeInterface(t *testing.T) {
	var _ Shape = Rectangle{}
	var _ Shape = Circle{}
}
```
