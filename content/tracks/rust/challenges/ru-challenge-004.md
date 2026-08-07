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

Write your complete implementation below:

```rust
use std::collections::HashMap;
use std::time::Duration;

// Your implementation here
```

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

## Solution

```rust
use serde::Serialize;
use std::collections::HashMap;
use std::time::Duration;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Method {
    GET,
    POST,
    PUT,
    DELETE,
    PATCH,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Error {
    InvalidUrl(String),
    Serialization(String),
}

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Error::InvalidUrl(url) => write!(f, "Invalid URL: {}", url),
            Error::Serialization(message) => write!(f, "Serialization failed: {}", message),
        }
    }
}

impl std::error::Error for Error {}

#[derive(Debug, Clone)]
pub struct Request {
    pub method: Method,
    pub url: String,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
    pub timeout: Duration,
}

#[derive(Debug, Clone)]
pub struct RequestBuilder {
    method: Method,
    url: String,
    headers: HashMap<String, String>,
    query: Vec<(String, String)>,
    body: Option<Result<String, Error>>,
    timeout: Duration,
}

/// Percent-encodes everything outside the unreserved set.
///
/// Hand-written because the sandbox has no network and a URL-encoding crate is
/// not vendored; the unreserved set is small enough to state directly.
fn percent_encode(value: &str) -> String {
    let mut encoded = String::with_capacity(value.len());
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char)
            }
            _ => encoded.push_str(&format!("%{:02X}", byte)),
        }
    }
    encoded
}

impl RequestBuilder {
    pub fn new(method: Method, url: &str) -> Self {
        RequestBuilder {
            method,
            url: url.to_string(),
            headers: HashMap::new(),
            query: Vec::new(),
            body: None,
            timeout: Duration::from_secs(30),
        }
    }

    pub fn header(mut self, key: &str, value: &str) -> Self {
        self.headers.insert(key.to_string(), value.to_string());
        self
    }

    pub fn headers(mut self, map: HashMap<&str, &str>) -> Self {
        for (key, value) in map {
            self.headers.insert(key.to_string(), value.to_string());
        }
        self
    }

    pub fn query(mut self, key: &str, value: &str) -> Self {
        self.query.push((key.to_string(), value.to_string()));
        self
    }

    pub fn body<T: Serialize>(mut self, data: &T) -> Self {
        // The failure is carried rather than raised, so the chain stays
        // infallible and `build` remains the single place that can fail.
        self.body = Some(serde_json::to_string(data).map_err(|e| Error::Serialization(e.to_string())));
        self.header("Content-Type", "application/json")
    }

    pub fn timeout(mut self, duration: Duration) -> Self {
        self.timeout = duration;
        self
    }

    pub fn bearer_token(mut self, token: &str) -> Self {
        self.headers.insert("Authorization".to_string(), format!("Bearer {}", token));
        self
    }

    pub fn build(self) -> Result<Request, Error> {
        if !self.url.starts_with("http://") && !self.url.starts_with("https://") {
            return Err(Error::InvalidUrl(self.url));
        }

        let body = match self.body {
            Some(Ok(json)) => Some(json),
            Some(Err(error)) => return Err(error),
            None => None,
        };

        let mut url = self.url;
        if !self.query.is_empty() {
            let encoded: Vec<String> = self
                .query
                .iter()
                .map(|(k, v)| format!("{}={}", percent_encode(k), percent_encode(v)))
                .collect();
            let separator = if url.contains('?') { '&' } else { '?' };
            url = format!("{}{}{}", url, separator, encoded.join("&"));
        }

        Ok(Request { method: self.method, url, headers: self.headers, body, timeout: self.timeout })
    }
}
```
