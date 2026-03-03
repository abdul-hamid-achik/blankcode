---
slug: ru-challenge-004
title: 'Challenge: Build a Builder Pattern for HTTP Requests'
description: Implement a fluent builder pattern for constructing HTTP requests.
difficulty: advanced
type: challenge
tags:
  - builder-pattern
  - http
  - api
---

# Challenge: HTTP Request Builder

## Requirements

Create a `RequestBuilder` struct with the following features:

1. **new(method: Method, url: &str) -> Self** - Create new builder
2. **header(key: &str, value: &str) -> Self** - Add header
3. **headers(map: HashMap<&str, &str>) -> Self** - Add multiple headers
4. **query(key: &str, value: &str) -> Self** - Add query parameter
5. **body<T: Serialize>(data: &T) -> Self** - Set JSON body
6. **timeout(duration: Duration) -> Self** - Set timeout
7. **bearer_token(token: &str) -> Self** - Set auth token
8. **build() -> Result<Request, Error>** - Build final request

## Constraints

- Fluent/builder pattern (method chaining)
- Proper error handling
- URL encoding for query params
- JSON serialization for body
- Clone-friendly builder

## Example Usage

```rust
let request = RequestBuilder::new(Method::GET, "https://api.example.com/users")
    .header("Accept", "application/json")
    .query("page", "1")
    .query("limit", "10")
    .bearer_token("my-token")
    .timeout(Duration::from_secs(30))
    .build()?;
```

Write your complete implementation below:

```rust
use std::collections::HashMap;
use std::time::Duration;

// Your implementation here
```

## Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use serde::Serialize;

    #[test]
    fn test_basic_request() {
        let builder = RequestBuilder::new(Method::GET, "https://api.example.com/users");
        let request = builder.build().unwrap();
        
        assert_eq!(request.method, Method::GET);
        assert_eq!(request.url, "https://api.example.com/users");
    }

    #[test]
    fn test_add_headers() {
        let request = RequestBuilder::new(Method::GET, "https://api.example.com")
            .header("Accept", "application/json")
            .header("Authorization", "Bearer token")
            .build()
            .unwrap();
        
        assert_eq!(request.headers.get("Accept"), Some(&"application/json".to_string()));
        assert_eq!(request.headers.get("Authorization"), Some(&"Bearer token".to_string()));
    }

    #[test]
    fn test_add_multiple_headers_at_once() {
        let mut headers = HashMap::new();
        headers.insert("X-Custom-1", "value1");
        headers.insert("X-Custom-2", "value2");
        
        let request = RequestBuilder::new(Method::GET, "https://api.example.com")
            .headers(headers)
            .build()
            .unwrap();
        
        assert_eq!(request.headers.get("X-Custom-1"), Some(&"value1".to_string()));
        assert_eq!(request.headers.get("X-Custom-2"), Some(&"value2".to_string()));
    }

    #[test]
    fn test_query_parameters() {
        let request = RequestBuilder::new(Method::GET, "https://api.example.com/users")
            .query("page", "1")
            .query("limit", "10")
            .build()
            .unwrap();
        
        assert!(request.url.contains("page=1"));
        assert!(request.url.contains("limit=10"));
    }

    #[test]
    fn test_query_parameter_encoding() {
        let request = RequestBuilder::new(Method::GET, "https://api.example.com/search")
            .query("q", "hello world")
            .query("filter", "a&b")
            .build()
            .unwrap();
        
        assert!(request.url.contains("hello%20world"));
        assert!(request.url.contains("a%26b"));
    }

    #[test]
    fn test_json_body() {
        #[derive(Serialize)]
        struct Payload {
            name: String,
            age: u32,
        }
        
        let payload = Payload {
            name: "John".to_string(),
            age: 30,
        };
        
        let request = RequestBuilder::new(Method::POST, "https://api.example.com/users")
            .body(&payload)
            .build()
            .unwrap();
        
        assert!(request.body.is_some());
        assert_eq!(
            request.headers.get("Content-Type"),
            Some(&"application/json".to_string())
        );
    }

    #[test]
    fn test_bearer_token() {
        let request = RequestBuilder::new(Method::GET, "https://api.example.com")
            .bearer_token("my-secret-token")
            .build()
            .unwrap();
        
        assert_eq!(
            request.headers.get("Authorization"),
            Some(&"Bearer my-secret-token".to_string())
        );
    }

    #[test]
    fn test_timeout() {
        let request = RequestBuilder::new(Method::GET, "https://api.example.com")
            .timeout(Duration::from_secs(30))
            .build()
            .unwrap();
        
        assert_eq!(request.timeout, Duration::from_secs(30));
    }

    #[test]
    fn test_builder_reuse() {
        let base = RequestBuilder::new(Method::GET, "https://api.example.com")
            .header("Accept", "application/json");
        
        let request1 = base.clone()
            .query("page", "1")
            .build()
            .unwrap();
        
        let request2 = base.clone()
            .query("page", "2")
            .build()
            .unwrap();
        
        assert!(request1.url.contains("page=1"));
        assert!(request2.url.contains("page=2"));
    }

    #[test]
    fn test_invalid_url() {
        let result = RequestBuilder::new(Method::GET, "not-a-valid-url")
            .build();
        
        assert!(result.is_err());
    }

    #[test]
    fn test_complex_request() {
        #[derive(Serialize)]
        struct CreateUser {
            email: String,
            password: String,
        }
        
        let payload = CreateUser {
            email: "test@example.com".to_string(),
            password: "secret".to_string(),
        };
        
        let request = RequestBuilder::new(Method::POST, "https://api.example.com/users")
            .header("X-API-Key", "my-key")
            .header("Accept", "application/json")
            .bearer_token("auth-token")
            .body(&payload)
            .timeout(Duration::from_secs(60))
            .build()
            .unwrap();
        
        assert_eq!(request.method, Method::POST);
        assert_eq!(request.headers.len(), 4); // Content-Type + 3 custom
        assert!(request.body.is_some());
        assert_eq!(request.timeout, Duration::from_secs(60));
    }
}
```
