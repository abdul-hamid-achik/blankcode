---
slug: go-challenge-005
title: 'Challenge: Build a HTTP Router'
description: Implement a high-performance HTTP request router with path parameters.
difficulty: expert
type: challenge
tags:
  - http
  - routing
  - performance
---

# Challenge: HTTP Router

## Requirements

Create a `Router` type with the following features:

1. **NewRouter() *Router** - Create new router
2. **Handle(method, path string, handler HandlerFunc)** - Register route
3. **GET/POST/PUT/DELETE(path, handler)** - HTTP method shortcuts
4. **ServeHTTP(w ResponseWriter, r *Request)** - Implement http.Handler
5. **Path parameters** - Support :param and *wildcard
6. **Middleware support** - Chain middleware functions

## HandlerFunc Signature

```go
type HandlerFunc func(w http.ResponseWriter, r *http.Request, params Params)
```

## Constraints

- Use radix tree for efficient routing
- Extract path parameters
- Support wildcards (*path)
- Handle 404 and 405 responses
- Thread-safe route registration

## Example Usage

```go
router := NewRouter()

router.Use(loggingMiddleware)
router.Use(authMiddleware)

router.GET("/users", getUsersHandler)
router.GET("/users/:id", getUserHandler)
router.POST("/users", createUserHandler)
router.GET("/files/*filepath", filesHandler)

http.ListenAndServe(":8080", router)
```

Write your complete implementation below:

```go
package main

import "net/http"

// Your implementation here
```

## Tests

```go
package main

import (
    "net/http"
    "net/http/httptest"
    "testing"
)

func TestRouterBasicRoute(t *testing.T) {
    router := NewRouter()
    
    router.GET("/hello", func(w http.ResponseWriter, r *http.Request, params Params) {
        w.Write([]byte("Hello World"))
    })
    
    req := httptest.NewRequest("GET", "/hello", nil)
    w := httptest.NewRecorder()
    
    router.ServeHTTP(w, req)
    
    if w.Code != 200 {
        t.Errorf("Expected 200, got %d", w.Code)
    }
    if w.Body.String() != "Hello World" {
        t.Errorf("Expected 'Hello World', got '%s'", w.Body.String())
    }
}

func TestRouterPathParameter(t *testing.T) {
    router := NewRouter()
    var capturedID string
    
    router.GET("/users/:id", func(w http.ResponseWriter, r *http.Request, params Params) {
        capturedID = params.ByName("id")
    })
    
    req := httptest.NewRequest("GET", "/users/123", nil)
    w := httptest.NewRecorder()
    
    router.ServeHTTP(w, req)
    
    if capturedID != "123" {
        t.Errorf("Expected '123', got '%s'", capturedID)
    }
}

func TestRouterMultiplePathParameters(t *testing.T) {
    router := NewRouter()
    var userID, postID string
    
    router.GET("/users/:userId/posts/:postId", func(w http.ResponseWriter, r *http.Request, params Params) {
        userID = params.ByName("userId")
        postID = params.ByName("postId")
    })
    
    req := httptest.NewRequest("GET", "/users/1/posts/2", nil)
    w := httptest.NewRecorder()
    
    router.ServeHTTP(w, req)
    
    if userID != "1" {
        t.Errorf("Expected userID '1', got '%s'", userID)
    }
    if postID != "2" {
        t.Errorf("Expected postID '2', got '%s'", postID)
    }
}

func TestRouterWildcard(t *testing.T) {
    router := NewRouter()
    var filepath string
    
    router.GET("/files/*filepath", func(w http.ResponseWriter, r *http.Request, params Params) {
        filepath = params.ByName("filepath")
    })
    
    req := httptest.NewRequest("GET", "/files/css/style.css", nil)
    w := httptest.NewRecorder()
    
    router.ServeHTTP(w, req)
    
    if filepath != "css/style.css" {
        t.Errorf("Expected 'css/style.css', got '%s'", filepath)
    }
}

func TestRouterNotFound(t *testing.T) {
    router := NewRouter()
    
    router.GET("/hello", func(w http.ResponseWriter, r *http.Request, params Params) {})
    
    req := httptest.NewRequest("GET", "/notfound", nil)
    w := httptest.NewRecorder()
    
    router.ServeHTTP(w, req)
    
    if w.Code != 404 {
        t.Errorf("Expected 404, got %d", w.Code)
    }
}

func TestRouterMethodNotAllowed(t *testing.T) {
    router := NewRouter()
    
    router.GET("/hello", func(w http.ResponseWriter, r *http.Request, params Params) {})
    
    req := httptest.NewRequest("POST", "/hello", nil)
    w := httptest.NewRecorder()
    
    router.ServeHTTP(w, req)
    
    if w.Code != 405 {
        t.Errorf("Expected 405, got %d", w.Code)
    }
}

func TestRouterHTTPMethods(t *testing.T) {
    router := NewRouter()
    
    methods := []string{"GET", "POST", "PUT", "DELETE", "PATCH"}
    
    for _, method := range methods {
        router.Handle(method, "/test", func(w http.ResponseWriter, r *http.Request, params Params) {
            w.Write([]byte(method))
        })
    }
    
    for _, method := range methods {
        req := httptest.NewRequest(method, "/test", nil)
        w := httptest.NewRecorder()
        
        router.ServeHTTP(w, req)
        
        if w.Code != 200 {
            t.Errorf("%s: Expected 200, got %d", method, w.Code)
        }
        if w.Body.String() != method {
            t.Errorf("%s: Expected '%s', got '%s'", method, method, w.Body.String())
        }
    }
}

func TestRouterMiddleware(t *testing.T) {
    router := NewRouter()
    var middlewareCalled bool
    
    router.Use(func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            middlewareCalled = true
            next.ServeHTTP(w, r)
        })
    })
    
    router.GET("/test", func(w http.ResponseWriter, r *http.Request, params Params) {})
    
    req := httptest.NewRequest("GET", "/test", nil)
    w := httptest.NewRecorder()
    
    router.ServeHTTP(w, req)
    
    if !middlewareCalled {
        t.Error("Middleware was not called")
    }
}

func TestRouterMiddlewareChain(t *testing.T) {
    router := NewRouter()
    var calls []string
    
    router.Use(func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            calls = append(calls, "middleware1-before")
            next.ServeHTTP(w, r)
            calls = append(calls, "middleware1-after")
        })
    })
    
    router.Use(func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            calls = append(calls, "middleware2-before")
            next.ServeHTTP(w, r)
            calls = append(calls, "middleware2-after")
        })
    })
    
    router.GET("/test", func(w http.ResponseWriter, r *http.Request, params Params) {
        calls = append(calls, "handler")
    })
    
    req := httptest.NewRequest("GET", "/test", nil)
    w := httptest.NewRecorder()
    
    router.ServeHTTP(w, req)
    
    expected := []string{
        "middleware1-before",
        "middleware2-before",
        "handler",
        "middleware2-after",
        "middleware1-after",
    }
    
    for i, call := range calls {
        if call != expected[i] {
            t.Errorf("Expected '%s' at %d, got '%s'", expected[i], i, call)
        }
    }
}

func TestRouterStaticVsDynamic(t *testing.T) {
    router := NewRouter()
    
    router.GET("/users/new", func(w http.ResponseWriter, r *http.Request, params Params) {
        w.Write([]byte("static"))
    })
    
    router.GET("/users/:id", func(w http.ResponseWriter, r *http.Request, params Params) {
        w.Write([]byte("dynamic"))
    })
    
    // Test static route
    req := httptest.NewRequest("GET", "/users/new", nil)
    w := httptest.NewRecorder()
    router.ServeHTTP(w, req)
    
    if w.Body.String() != "static" {
        t.Errorf("Expected 'static', got '%s'", w.Body.String())
    }
    
    // Test dynamic route
    req = httptest.NewRequest("GET", "/users/123", nil)
    w = httptest.NewRecorder()
    router.ServeHTTP(w, req)
    
    if w.Body.String() != "dynamic" {
        t.Errorf("Expected 'dynamic', got '%s'", w.Body.String())
    }
}

func TestRouterConcurrentRegistration(t *testing.T) {
    router := NewRouter()
    done := make(chan bool)
    
    for i := 0; i < 100; i++ {
        go func(id int) {
            router.GET(fmt.Sprintf("/route/%d", id), func(w http.ResponseWriter, r *http.Request, params Params) {})
            done <- true
        }(i)
    }
    
    for i := 0; i < 100; i++ {
        <-done
    }
    
    // Should not panic
}
```
