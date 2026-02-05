---
slug: go-advancedpatterns-factory-pattern
title: Implementing the Factory Pattern in Go
description: Learn how to implement the Factory design pattern to create objects without specifying their exact types, promoting loose coupling and flexibility.
difficulty: beginner
hints:
  - The factory function should return an interface type, not a concrete struct
  - Use a switch statement or map to determine which concrete type to create
  - Constructor functions in Go typically start with "New"
  - The factory hides the implementation details from the caller
tags:
  - go
  - advanced-patterns
  - factory-pattern
  - design-patterns
  - interfaces
---

Implement a Factory pattern for creating different types of notifications (Email and SMS). The factory function should accept a notification type and return the appropriate implementation of the `Notifier` interface.

Complete the code by:
1. Defining the `Notifier` interface with a `Send` method
2. Implementing the factory function that returns the correct notifier type
3. Handling the case when an invalid type is provided
4. Calling the factory function to create an SMS notifier

```go
package main

import (
	"errors"
	"fmt"
)

// Notifier is an interface for sending notifications
type ___blank_start___Notifier interface {
	Send(message string) error
}___blank_end___

// EmailNotifier sends notifications via email
type EmailNotifier struct {
	recipient string
}

func (e *EmailNotifier) Send(message string) error {
	fmt.Printf("Sending email to %s: %s\n", e.recipient, message)
	return nil
}

// SMSNotifier sends notifications via SMS
type SMSNotifier struct {
	phoneNumber string
}

func (s *SMSNotifier) Send(message string) error {
	fmt.Printf("Sending SMS to %s: %s\n", s.phoneNumber, message)
	return nil
}

// NewNotifier is a factory function that creates the appropriate notifier
func NewNotifier(notifierType string, contact string) ___blank_start___(Notifier, error)___blank_end___ {
	switch notifierType {
	case "email":
		return &EmailNotifier{recipient: contact}, nil
	case "sms":
		return &SMSNotifier{phoneNumber: contact}, nil
	default:
		___blank_start___return nil, errors.New("invalid notifier type")___blank_end___
	}
}

func main() {
	// Create an SMS notifier using the factory
	notifier, err := ___blank_start___NewNotifier("sms", "+1234567890")___blank_end___
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	
	notifier.Send("Hello from the factory pattern!")
}
```

## Tests

```go
package main

import "testing"

func TestNotifierFactory(t *testing.T) {
	notifier, err := NewNotifier("sms", "+1234567890")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if notifier == nil {
		t.Fatalf("expected notifier to be created")
	}
}

func TestInvalidNotifierType(t *testing.T) {
	notifier, err := NewNotifier("invalid", "foo")
	if err == nil {
		t.Fatalf("expected error for invalid type")
	}
	if notifier != nil {
		t.Fatalf("expected nil notifier for invalid type")
	}
}

func TestInterfaceImplementation(t *testing.T) {
	var _ Notifier = &EmailNotifier{}
	var _ Notifier = &SMSNotifier{}
}
```
