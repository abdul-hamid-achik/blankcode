---
slug: ru-challenge-005
title: 'Challenge: Build an Async Runtime'
description: Implement a minimal async runtime with task scheduling.
difficulty: expert
type: challenge
tags:
  - async
  - runtime
  - futures
---

# Challenge: Minimal Async Runtime

## Requirements

Create a minimal async runtime with the following features:

1. **Runtime struct** - Main runtime executor
2. **spawn(future) -> JoinHandle** - Spawn async task
3. **block_on(future)** - Run async code to completion
4. **yield_now()** - Yield execution to other tasks
5. **sleep(duration)** - Async sleep
6. **Channel mpsc** - Multi-producer single-consumer channel

## Constraints

- Use Pin and Future traits
- Implement Waker correctly
- Fair task scheduling (round-robin)
- Handle panics gracefully
- No external async runtime dependencies

Write your complete implementation below:

```rust
use std::future::Future;
use std::pin::Pin;
use std::task::{Context, Poll, Waker};
use std::sync::{Arc, Mutex};

// Your implementation here
```

## Example Usage

```rust
fn main() {
    let rt = Runtime::new();
    
    rt.block_on(async {
        let handle = rt.spawn(async {
            println!("Hello from task!");
            42
        });
        
        let result = handle.await;
        println!("Task returned: {:?}", result);
    });
}
```

## Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    #[test]
    fn test_block_on_simple() {
        let rt = Runtime::new();
        
        let result = rt.block_on(async {
            42
        });
        
        assert_eq!(result, 42);
    }

    #[test]
    fn test_spawn_and_await() {
        let rt = Runtime::new();
        
        rt.block_on(async {
            let handle = rt.spawn(async {
                100
            });
            
            assert_eq!(handle.await.unwrap(), 100);
        });
    }

    #[test]
    fn test_spawn_multiple_tasks() {
        let rt = Runtime::new();
        
        rt.block_on(async {
            let mut handles = vec![];
            
            for i in 0..10 {
                let handle = rt.spawn(async move {
                    i * 2
                });
                handles.push(handle);
            }
            
            for (i, handle) in handles.into_iter().enumerate() {
                assert_eq!(handle.await.unwrap(), i * 2);
            }
        });
    }

    #[test]
    fn test_yield_now() {
        let rt = Runtime::new();
        let counter = Arc::new(AtomicUsize::new(0));
        
        let first = counter.clone();
        let second = counter.clone();
        rt.block_on(async {
            let handle1 = rt.spawn(async move {
                first.fetch_add(1, Ordering::SeqCst);
                yield_now().await;
                first.fetch_add(1, Ordering::SeqCst);
            });
            
            let handle2 = rt.spawn(async move {
                second.fetch_add(1, Ordering::SeqCst);
            });
            
            handle1.await;
            handle2.await;
        });
        
        assert_eq!(counter.load(Ordering::SeqCst), 3);
    }

    #[test]
    fn test_sleep() {
        let rt = Runtime::new();
        
        let start = std::time::Instant::now();
        
        rt.block_on(async {
            sleep(std::time::Duration::from_millis(100)).await;
        });
        
        assert!(start.elapsed() >= std::time::Duration::from_millis(100));
    }

    #[test]
    fn test_channel_mpsc() {
        let rt = Runtime::new();
        
        rt.block_on(async {
            let (tx, mut rx) = mpsc::channel::<i32>(10);
            
            tx.send(1).await;
            tx.send(2).await;
            tx.send(3).await;
            
            drop(tx); // Close sender
            
            let mut received = vec![];
            while let Some(value) = rx.recv().await {
                received.push(value);
            }
            
            assert_eq!(received, vec![1, 2, 3]);
        });
    }

    #[test]
    fn test_channel_multiple_senders() {
        let rt = Runtime::new();
        
        rt.block_on(async {
            let (tx, mut rx) = mpsc::channel::<i32>(10);
            let tx2 = tx.clone();
            
            rt.spawn(async move {
                tx.send(1).await;
            });
            
            rt.spawn(async move {
                tx2.send(2).await;
            });
            
            let mut received = vec![];
            while let Some(value) = rx.recv().await {
                received.push(value);
            }
            
            assert_eq!(received.len(), 2);
        });
    }

    #[test]
    fn test_task_panic_handling() {
        let rt = Runtime::new();
        
        rt.block_on(async {
            let handle = rt.spawn(async {
                panic!("Task panicked!");
            });
            
            // Should not panic the whole runtime
            let result = handle.await;
            assert!(result.is_err());
        });
    }

    #[test]
    fn test_concurrent_counter() {
        let rt = Runtime::new();
        let counter = Arc::new(AtomicUsize::new(0));
        
        rt.block_on(async {
            let mut handles = vec![];
            
            for _ in 0..100 {
                let counter = Arc::clone(&counter);
                let handle = rt.spawn(async move {
                    counter.fetch_add(1, Ordering::SeqCst);
                });
                handles.push(handle);
            }
            
            for handle in handles {
                handle.await.unwrap();
            }
        });
        
        assert_eq!(counter.load(Ordering::SeqCst), 100);
    }

    #[test]
    fn test_nested_spawn() {
        let rt = Runtime::new();
        
        rt.block_on(async {
            let outer = rt.spawn(async {
                let inner = spawn(async {
                    42
                });
                inner.await.unwrap()
            });
            
            assert_eq!(outer.await.unwrap(), 42);
        });
    }

    #[test]
    fn test_async_iteration() {
        let rt = Runtime::new();
        
        rt.block_on(async {
            let mut sum = 0;
            for i in 0..10 {
                sum += i;
                yield_now().await;
            }
            assert_eq!(sum, 45);
        });
    }
}
```

## Solution

```rust
use std::cell::RefCell;
use std::collections::VecDeque;
use std::future::Future;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::pin::Pin;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::task::{Context, Poll, RawWaker, RawWakerVTable, Waker};
use std::thread;
use std::time::{Duration, Instant};

type BoxedTask = Pin<Box<dyn Future<Output = ()>>>;

thread_local! {
    /// The queue the current `block_on` is draining.
    ///
    /// This is what lets a task spawn another task: a spawned future has to be
    /// `'static`, so it cannot hold a borrow of the Runtime, and it needs some
    /// other way to reach the executor it is already running on.
    static CURRENT: RefCell<Option<Arc<TaskQueue>>> = const { RefCell::new(None) };
}

#[derive(Default)]
struct TaskQueue {
    ready: Mutex<VecDeque<BoxedTask>>,
}

pub struct Runtime {
    queue: Arc<TaskQueue>,
}

#[derive(Debug, PartialEq, Eq)]
pub struct JoinError;

/// The result slot a spawned task writes into and its handle reads from.
struct Slot<T> {
    value: Mutex<Option<Result<T, JoinError>>>,
}

pub struct JoinHandle<T> {
    slot: Arc<Slot<T>>,
}

impl<T> Future for JoinHandle<T> {
    type Output = Result<T, JoinError>;

    fn poll(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<Self::Output> {
        match self.slot.value.lock().unwrap().take() {
            Some(result) => Poll::Ready(result),
            None => Poll::Pending,
        }
    }
}

/// Turns a panic during a poll into an error value.
///
/// The panic happens while the future runs, not while it is built, so it has to
/// be caught around each individual poll — there is no way to wrap an `.await`.
struct CatchUnwind<F> {
    inner: Pin<Box<F>>,
}

impl<F: Future> Future for CatchUnwind<F> {
    type Output = Result<F::Output, JoinError>;

    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        let this = self.get_mut();
        match catch_unwind(AssertUnwindSafe(|| this.inner.as_mut().poll(cx))) {
            Ok(Poll::Ready(value)) => Poll::Ready(Ok(value)),
            Ok(Poll::Pending) => Poll::Pending,
            // The task is over either way; the runtime and every other task
            // carry on, and whoever awaits the handle is told what happened.
            Err(_) => Poll::Ready(Err(JoinError)),
        }
    }
}

fn push<F>(queue: &Arc<TaskQueue>, future: F) -> JoinHandle<F::Output>
where
    F: Future + 'static,
{
    let slot = Arc::new(Slot { value: Mutex::new(None) });
    let writer = Arc::clone(&slot);

    queue.ready.lock().unwrap().push_back(Box::pin(async move {
        let result = CatchUnwind { inner: Box::pin(future) }.await;
        *writer.value.lock().unwrap() = Some(result);
    }));

    JoinHandle { slot }
}

impl Runtime {
    pub fn new() -> Self {
        Runtime { queue: Arc::new(TaskQueue::default()) }
    }

    pub fn spawn<F>(&self, future: F) -> JoinHandle<F::Output>
    where
        F: Future + 'static,
    {
        push(&self.queue, future)
    }

    /// Drives `future` to completion, running spawned tasks whenever it waits.
    ///
    /// Cooperative and single-threaded: nothing here runs in parallel, tasks
    /// simply take turns at their await points. That is enough for everything
    /// the runtime promises, and it means no task can observe a data race.
    pub fn block_on<F: Future>(&self, future: F) -> F::Output {
        let previous = CURRENT.with(|current| current.borrow_mut().replace(Arc::clone(&self.queue)));

        let waker = noop_waker();
        let mut context = Context::from_waker(&waker);
        let mut main = Box::pin(future);

        let output = loop {
            if let Poll::Ready(value) = main.as_mut().poll(&mut context) {
                break value;
            }

            // One pass over everything currently queued. Tasks that are still
            // pending go to the back, so a task blocked on another cannot
            // starve the one it is waiting for.
            let queued: Vec<BoxedTask> = {
                let mut ready = self.queue.ready.lock().unwrap();
                ready.drain(..).collect()
            };

            let progressed = !queued.is_empty();
            for mut task in queued {
                if task.as_mut().poll(&mut context).is_pending() {
                    self.queue.ready.lock().unwrap().push_back(task);
                }
            }

            // Nothing to run and the main future is still waiting: it must be
            // waiting on time, so yield the CPU rather than spin on it.
            if !progressed {
                thread::sleep(Duration::from_micros(200));
            }
        };

        // Finish whatever the main future left running, so a spawned task that
        // outlives it still gets to complete.
        loop {
            let queued: Vec<BoxedTask> = {
                let mut ready = self.queue.ready.lock().unwrap();
                ready.drain(..).collect()
            };
            if queued.is_empty() {
                break;
            }
            for mut task in queued {
                if task.as_mut().poll(&mut context).is_pending() {
                    self.queue.ready.lock().unwrap().push_back(task);
                }
            }
        }

        CURRENT.with(|current| *current.borrow_mut() = previous);
        output
    }
}

impl Default for Runtime {
    fn default() -> Self {
        Self::new()
    }
}

/// Spawns onto the runtime already running on this thread.
pub fn spawn<F>(future: F) -> JoinHandle<F::Output>
where
    F: Future + 'static,
{
    let queue = CURRENT
        .with(|current| current.borrow().clone())
        .expect("spawn called outside of a runtime");
    push(&queue, future)
}

/// A future that is pending exactly once, handing control back to the executor.
pub struct YieldNow {
    yielded: bool,
}

impl Future for YieldNow {
    type Output = ();

    fn poll(mut self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<()> {
        if self.yielded {
            return Poll::Ready(());
        }
        self.yielded = true;
        Poll::Pending
    }
}

pub fn yield_now() -> YieldNow {
    YieldNow { yielded: false }
}

pub struct Sleep {
    until: Instant,
}

impl Future for Sleep {
    type Output = ();

    fn poll(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<()> {
        if Instant::now() >= self.until {
            Poll::Ready(())
        } else {
            Poll::Pending
        }
    }
}

pub fn sleep(duration: Duration) -> Sleep {
    Sleep { until: Instant::now() + duration }
}

pub mod mpsc {
    use super::*;

    struct Shared<T> {
        queue: Mutex<VecDeque<T>>,
        capacity: usize,
        senders: AtomicUsize,
    }

    pub struct Sender<T> {
        shared: Arc<Shared<T>>,
    }

    pub struct Receiver<T> {
        shared: Arc<Shared<T>>,
    }

    pub fn channel<T>(capacity: usize) -> (Sender<T>, Receiver<T>) {
        let shared = Arc::new(Shared {
            queue: Mutex::new(VecDeque::new()),
            capacity,
            senders: AtomicUsize::new(1),
        });
        (Sender { shared: Arc::clone(&shared) }, Receiver { shared })
    }

    impl<T> Clone for Sender<T> {
        fn clone(&self) -> Self {
            // Counted rather than inferred from the Arc: the receiver holds one
            // too, so Arc::strong_count would never reach zero.
            self.shared.senders.fetch_add(1, Ordering::SeqCst);
            Sender { shared: Arc::clone(&self.shared) }
        }
    }

    impl<T> Drop for Sender<T> {
        fn drop(&mut self) {
            self.shared.senders.fetch_sub(1, Ordering::SeqCst);
        }
    }

    pub struct Send<'a, T> {
        shared: &'a Arc<Shared<T>>,
        value: Option<T>,
    }

    // `T: Unpin` because the value being sent is moved out of the future when
    // it completes, and moving out of a pinned field is only sound when the
    // field does not care about its address.
    impl<T: Unpin> Future for Send<'_, T> {
        type Output = ();

        fn poll(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<()> {
            let this = self.get_mut();
            let mut queue = this.shared.queue.lock().unwrap();
            if queue.len() >= this.shared.capacity {
                // Backpressure: a full channel makes the sender wait instead of
                // growing without bound.
                return Poll::Pending;
            }
            let value = this.value.take().expect("polled after completion");
            queue.push_back(value);
            Poll::Ready(())
        }
    }

    impl<T> Sender<T> {
        pub fn send(&self, value: T) -> Send<'_, T> {
            Send { shared: &self.shared, value: Some(value) }
        }
    }

    pub struct Recv<'a, T> {
        shared: &'a Arc<Shared<T>>,
    }

    impl<T> Future for Recv<'_, T> {
        type Output = Option<T>;

        fn poll(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<Option<T>> {
            let mut queue = self.shared.queue.lock().unwrap();
            if let Some(value) = queue.pop_front() {
                return Poll::Ready(Some(value));
            }
            // Empty *and* nobody left to fill it is the only case where the
            // channel is really over; empty on its own just means "not yet".
            if self.shared.senders.load(Ordering::SeqCst) == 0 {
                return Poll::Ready(None);
            }
            Poll::Pending
        }
    }

    impl<T> Receiver<T> {
        pub fn recv(&mut self) -> Recv<'_, T> {
            Recv { shared: &self.shared }
        }
    }
}

/// A waker that does nothing.
///
/// The executor re-polls every pending task on each pass, so it never needs to
/// be told that a task became ready. A real runtime would park until woken;
/// this one trades that efficiency for a scheduler that fits on a page.
fn noop_waker() -> Waker {
    fn clone(_: *const ()) -> RawWaker {
        RawWaker::new(std::ptr::null(), &VTABLE)
    }
    fn noop(_: *const ()) {}

    static VTABLE: RawWakerVTable = RawWakerVTable::new(clone, noop, noop, noop);

    unsafe { Waker::from_raw(RawWaker::new(std::ptr::null(), &VTABLE)) }
}
```
