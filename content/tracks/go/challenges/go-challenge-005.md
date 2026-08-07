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

Write your complete implementation below:

```go
package main

import "net/http"

// Your implementation here
```

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

## Tests

```go
package main

import (
    "fmt"
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
            router.GET(fmt.Sprintf("/route/%d", id), func(w http.ResponseWriter, r *http.Request, params Params) {
                w.Write([]byte(fmt.Sprintf("route-%d", id)))
            })
            done <- true
        }(i)
    }
    
    for i := 0; i < 100; i++ {
        <-done
    }
    
    // All 100 concurrently-registered routes must be reachable with the
    // correct handler wired up — not just "did not panic".
    for _, id := range []int{0, 42, 99} {
        req := httptest.NewRequest("GET", fmt.Sprintf("/route/%d", id), nil)
        w := httptest.NewRecorder()
        router.ServeHTTP(w, req)
        
        if w.Code != 200 {
            t.Errorf("route %d: expected 200, got %d", id, w.Code)
        }
        want := fmt.Sprintf("route-%d", id)
        if w.Body.String() != want {
            t.Errorf("route %d: expected body %q, got %q", id, want, w.Body.String())
        }
    }
}
```

## Solution

```go
package main

import (
	"net/http"
	"strings"
	"sync"
)

type Params map[string]string

func (p Params) ByName(name string) string {
	return p[name]
}

type HandlerFunc func(w http.ResponseWriter, r *http.Request, params Params)

type Middleware func(http.Handler) http.Handler

type route struct {
	method   string
	segments []string
	handler  HandlerFunc
}

type Router struct {
	// Routes are registered concurrently in practice (init functions, tests),
	// and served concurrently always, so the slice needs a lock on both sides.
	mu          sync.RWMutex
	routes      []route
	middlewares []Middleware
}

func NewRouter() *Router {
	return &Router{}
}

func (router *Router) Use(mw Middleware) {
	router.mu.Lock()
	defer router.mu.Unlock()
	router.middlewares = append(router.middlewares, mw)
}

func (router *Router) Handle(method, path string, handler HandlerFunc) {
	router.mu.Lock()
	defer router.mu.Unlock()
	router.routes = append(router.routes, route{
		method:   method,
		segments: splitPath(path),
		handler:  handler,
	})
}

func (router *Router) GET(path string, handler HandlerFunc) {
	router.Handle(http.MethodGet, path, handler)
}

func (router *Router) POST(path string, handler HandlerFunc) {
	router.Handle(http.MethodPost, path, handler)
}

func (router *Router) PUT(path string, handler HandlerFunc) {
	router.Handle(http.MethodPut, path, handler)
}

func (router *Router) DELETE(path string, handler HandlerFunc) {
	router.Handle(http.MethodDelete, path, handler)
}

func splitPath(path string) []string {
	trimmed := strings.Trim(path, "/")
	if trimmed == "" {
		return []string{}
	}
	return strings.Split(trimmed, "/")
}

// match reports whether the route matches, the captured params, and a score.
// The score is what makes `/users/new` win over `/users/:id`: a literal
// segment costs nothing, a parameter costs one, a wildcard costs two, and the
// cheapest match wins.
func (r route) match(segments []string) (Params, int, bool) {
	params := Params{}
	score := 0

	for i, pattern := range r.segments {
		if strings.HasPrefix(pattern, "*") {
			params[pattern[1:]] = strings.Join(segments[i:], "/")
			return params, score + 2, true
		}
		if i >= len(segments) {
			return nil, 0, false
		}
		if strings.HasPrefix(pattern, ":") {
			params[pattern[1:]] = segments[i]
			score++
			continue
		}
		if pattern != segments[i] {
			return nil, 0, false
		}
	}

	if len(segments) != len(r.segments) {
		return nil, 0, false
	}
	return params, score, true
}

func (router *Router) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	router.mu.RLock()
	routes := make([]route, len(router.routes))
	copy(routes, router.routes)
	middlewares := make([]Middleware, len(router.middlewares))
	copy(middlewares, router.middlewares)
	router.mu.RUnlock()

	segments := splitPath(req.URL.Path)

	var best *route
	var bestParams Params
	bestScore := -1
	pathExists := false

	for i := range routes {
		params, score, ok := routes[i].match(segments)
		if !ok {
			continue
		}
		// The path exists even under another method — that is the difference
		// between 404 and 405.
		pathExists = true
		if routes[i].method != req.Method {
			continue
		}
		if bestScore == -1 || score < bestScore {
			best = &routes[i]
			bestParams = params
			bestScore = score
		}
	}

	var handler http.Handler
	switch {
	case best != nil:
		matched := *best
		params := bestParams
		handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			matched.handler(w, r, params)
		})
	case pathExists:
		handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusMethodNotAllowed)
		})
	default:
		handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusNotFound)
		})
	}

	// Applied in reverse so the first registered middleware ends up outermost,
	// which is what makes the before/after ordering nest the way callers expect.
	for i := len(middlewares) - 1; i >= 0; i-- {
		handler = middlewares[i](handler)
	}

	handler.ServeHTTP(w, req)
}
```
