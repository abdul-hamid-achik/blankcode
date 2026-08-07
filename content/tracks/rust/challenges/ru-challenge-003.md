---
slug: ru-challenge-003
title: 'Challenge: Build a Thread-Safe Cache with TTL'
description: Implement a concurrent cache with time-to-live expiration.
difficulty: advanced
type: challenge
tags:
  - concurrency
  - collections
  - ttl
---

# Challenge: TTL Cache

## Requirements

Create a `Cache<K, V>` struct with the following features:

1. **new() -> Self** - Create new cache
2. **insert(key: K, value: V, ttl: Duration) -> Option<V>** - Insert with TTL
3. **get(&self, key: &K) -> Option<V>** - Get value if not expired
4. **remove(&mut self, key: &K) -> Option<V>** - Remove key
5. **len(&self) -> usize** - Count non-expired entries
6. **clear(&mut self)** - Remove all entries
7. **cleanup_expired(&mut self) -> usize** - Remove expired, return count

## Constraints

- Thread-safe using RwLock or Mutex
- Auto-expire entries on access
- Background cleanup optional
- Generic over key and value types

Write your complete implementation below:

```rust
use std::time::Duration;
use std::collections::HashMap;
use std::sync::{RwLock, Arc};
use std::time::Instant;

// Your implementation here
```

## Example Usage

```rust
let cache = Cache::new();
cache.insert("key1", "value1", Duration::from_secs(60));
cache.insert("key2", 42, Duration::from_secs(30));

let value = cache.get(&"key1"); // Some("value1")
```

## Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;

    #[test]
    fn test_insert_and_get() {
        let cache = Cache::new();
        cache.insert("key", "value", Duration::from_secs(60));
        assert_eq!(cache.get(&"key"), Some("value"));
    }

    #[test]
    fn test_get_nonexistent() {
        let cache = Cache::<&str, &str>::new();
        assert_eq!(cache.get(&"nonexistent"), None);
    }

    #[test]
    fn test_insert_overwrite() {
        let cache = Cache::new();
        cache.insert("key", "value1", Duration::from_secs(60));
        let old = cache.insert("key", "value2", Duration::from_secs(60));
        assert_eq!(old, Some("value1"));
        assert_eq!(cache.get(&"key"), Some("value2"));
    }

    #[test]
    fn test_remove() {
        let cache = Cache::new();
        cache.insert("key", "value", Duration::from_secs(60));
        assert_eq!(cache.remove(&"key"), Some("value"));
        assert_eq!(cache.get(&"key"), None);
    }

    #[test]
    fn test_expiration() {
        let cache = Cache::new();
        cache.insert("key", "value", Duration::from_millis(100));
        
        assert_eq!(cache.get(&"key"), Some("value"));
        thread::sleep(Duration::from_millis(150));
        assert_eq!(cache.get(&"key"), None);
    }

    #[test]
    fn test_len() {
        let cache = Cache::new();
        assert_eq!(cache.len(), 0);
        
        cache.insert("key1", "value1", Duration::from_secs(60));
        cache.insert("key2", "value2", Duration::from_secs(60));
        assert_eq!(cache.len(), 2);
        
        cache.insert("key3", "value3", Duration::from_millis(50));
        thread::sleep(Duration::from_millis(100));
        assert_eq!(cache.len(), 2); // key3 expired
    }

    #[test]
    fn test_clear() {
        let cache = Cache::new();
        cache.insert("key1", "value1", Duration::from_secs(60));
        cache.insert("key2", "value2", Duration::from_secs(60));
        
        cache.clear();
        assert_eq!(cache.len(), 0);
        assert_eq!(cache.get(&"key1"), None);
    }

    #[test]
    fn test_cleanup_expired() {
        let cache = Cache::new();
        cache.insert("key1", "value1", Duration::from_secs(60));
        cache.insert("key2", "value2", Duration::from_millis(50));
        cache.insert("key3", "value3", Duration::from_millis(50));
        
        thread::sleep(Duration::from_millis(100));
        
        let removed = cache.cleanup_expired();
        assert_eq!(removed, 2);
        assert_eq!(cache.len(), 1);
    }

    #[test]
    fn test_concurrent_access() {
        let cache = Arc::new(Cache::new());
        let mut handles = vec![];
        
        for i in 0..10 {
            let cache = Arc::clone(&cache);
            handles.push(thread::spawn(move || {
                cache.insert(i, i * 2, Duration::from_secs(60));
                cache.get(&i)
            }));
        }
        
        for handle in handles {
            handle.join().unwrap();
        }
        
        assert_eq!(cache.len(), 10);
    }

    #[test]
    fn test_concurrent_read_write() {
        let cache = Arc::new(Cache::new());
        let mut handles = vec![];
        
        // Writer thread
        let cache_writer = Arc::clone(&cache);
        handles.push(thread::spawn(move || {
            for i in 0..100 {
                cache_writer.insert(i, i, Duration::from_secs(60));
            }
        }));
        
        // Reader threads
        for _ in 0..5 {
            let cache_reader = Arc::clone(&cache);
            handles.push(thread::spawn(move || {
                for i in 0..100 {
                    let _ = cache_reader.get(&i);
                }
            }));
        }
        
        for handle in handles {
            handle.join().unwrap();
        }

        assert_eq!(cache.len(), 100);
    }
}
```

## Solution

```rust
use std::collections::HashMap;
use std::hash::Hash;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

struct Entry<V> {
    value: V,
    expires_at: Instant,
}

/// A TTL cache that is shared, not owned exclusively.
///
/// Every method takes `&self`, including the mutating ones. That is what lets
/// an `Arc<Cache<..>>` be handed to several threads at once — with `&mut self`
/// the callers would need a lock around the whole cache anyway, so the lock
/// belongs inside it.
pub struct Cache<K, V> {
    entries: Arc<Mutex<HashMap<K, Entry<V>>>>,
}

impl<K, V> Cache<K, V>
where
    K: Eq + Hash + Clone,
    V: Clone,
{
    pub fn new() -> Self {
        Cache { entries: Arc::new(Mutex::new(HashMap::new())) }
    }

    pub fn insert(&self, key: K, value: V, ttl: Duration) -> Option<V> {
        let mut entries = self.entries.lock().unwrap();
        entries
            .insert(key, Entry { value, expires_at: Instant::now() + ttl })
            // An expired previous value is not a value the caller should get
            // back, so it reads as if the key had been absent.
            .filter(|previous| previous.expires_at > Instant::now())
            .map(|previous| previous.value)
    }

    pub fn get(&self, key: &K) -> Option<V> {
        let entries = self.entries.lock().unwrap();
        entries
            .get(key)
            .filter(|entry| entry.expires_at > Instant::now())
            .map(|entry| entry.value.clone())
    }

    pub fn remove(&self, key: &K) -> Option<V> {
        let mut entries = self.entries.lock().unwrap();
        entries
            .remove(key)
            .filter(|entry| entry.expires_at > Instant::now())
            .map(|entry| entry.value)
    }

    pub fn len(&self) -> usize {
        let entries = self.entries.lock().unwrap();
        let now = Instant::now();
        // Counts what is still live rather than what is still stored: an
        // expired entry is gone as far as any caller is concerned.
        entries.values().filter(|entry| entry.expires_at > now).count()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub fn clear(&self) {
        self.entries.lock().unwrap().clear();
    }

    pub fn cleanup_expired(&self) -> usize {
        let mut entries = self.entries.lock().unwrap();
        let now = Instant::now();
        let before = entries.len();
        entries.retain(|_, entry| entry.expires_at > now);
        before - entries.len()
    }
}

impl<K, V> Default for Cache<K, V>
where
    K: Eq + Hash + Clone,
    V: Clone,
{
    fn default() -> Self {
        Self::new()
    }
}
```
