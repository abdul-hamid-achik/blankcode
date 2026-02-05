---
slug: go-advancedpatterns-functional-options
title: Functional Options Pattern
description: Learn to implement the functional options pattern for flexible and extensible configuration in Go
difficulty: beginner
hints:
  - Option functions return a function that modifies the config struct
  - Each option should be a closure that captures its parameter
  - Apply options in order using a loop
  - Provide sensible defaults before applying options
tags:
  - go
  - advanced-patterns
  - functional-options
  - configuration
---

The **Functional Options Pattern** is a Go idiom for creating clean, extensible APIs. It's especially useful for constructors with many optional parameters.

Your task is to implement a `Server` configuration system using the functional options pattern. Complete the code by filling in the blanks to:

1. Define the `Option` type as a function that modifies a `Server`
2. Create option functions that return closures
3. Apply the options in the constructor

```go
package main

import "time"

type Server struct {
    host    string
    port    int
    timeout time.Duration
    maxConn int
}

// Option is a function that configures a Server
type Option ___blank_start___func(*Server)___blank_end___

// NewServer creates a new Server with default values and applies options
func NewServer(opts ...Option) *Server {
    // Set defaults
    s := &Server{
        host:    "localhost",
        port:    8080,
        timeout: 30 * time.Second,
        maxConn: 100,
    }
    
    // Apply all options
    for _, ___blank_start___opt___blank_end___ := range opts {
        ___blank_start___opt(s)___blank_end___
    }
    
    return s
}

// WithHost returns an Option that sets the host
func WithHost(host string) Option {
    return ___blank_start___func(s *Server) {
        s.host = host
    }___blank_end___
}

// WithPort returns an Option that sets the port
func WithPort(port int) Option {
    return func(s *Server) {
        s.port = port
    }
}

// WithTimeout returns an Option that sets the timeout
func WithTimeout(timeout time.Duration) Option {
    return func(s *Server) {
        s.timeout = timeout
    }
}

// WithMaxConnections returns an Option that sets max connections
func WithMaxConnections(maxConn int) Option {
    return func(s *Server) {
        s.maxConn = maxConn
    }
}
```

## Tests

```go
package main

import (
	"testing"
	"time"
)

func TestDefaults(t *testing.T) {
	s := NewServer()
	if s.host != "localhost" || s.port != 8080 || s.timeout != 30*time.Second || s.maxConn != 100 {
		t.Fatalf("expected defaults localhost:8080,30s,100 got %s:%d,%v,%d", s.host, s.port, s.timeout, s.maxConn)
	}
}

func TestCustomHostPort(t *testing.T) {
	s := NewServer(WithHost("0.0.0.0"), WithPort(3000))
	if s.host != "0.0.0.0" || s.port != 3000 {
		t.Fatalf("expected host 0.0.0.0 and port 3000, got %s:%d", s.host, s.port)
	}
}

func TestAllOptions(t *testing.T) {
	s := NewServer(
		WithHost("api.example.com"),
		WithPort(443),
		WithTimeout(60),
		WithMaxConnections(500),
	)
	if s.host != "api.example.com" || s.port != 443 || s.timeout != 60*time.Second || s.maxConn != 500 {
		t.Fatalf("expected api.example.com:443,60s,500 got %s:%d,%v,%d", s.host, s.port, s.timeout, s.maxConn)
	}
}

func TestOptionsOrder(t *testing.T) {
	s := NewServer(WithPort(8000), WithPort(9000))
	if s.port != 9000 {
		t.Fatalf("expected port 9000, got %d", s.port)
	}
}
```
