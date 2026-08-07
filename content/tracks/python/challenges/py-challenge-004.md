---
slug: py-challenge-004
title: 'Challenge: Build an Async Task Queue'
description: Create an asynchronous task queue with concurrency control.
difficulty: advanced
type: challenge
tags:
  - async
  - concurrency
  - queues
---

# Challenge: Async Task Queue

## Requirements

Create an `AsyncTaskQueue` class with the following features:

1. **__init__(max_concurrency: int = 5)** - Initialize with max concurrent tasks
2. **add(task: Callable) -> Task** - Add task to queue, return Task object
3. **run() -> None** - Start processing queue
4. **wait() -> None** - Wait for all tasks to complete
5. **size() -> int** - Get queue size
6. **pending() -> int** - Get number of pending tasks
7. **completed() -> int** - Get number of completed tasks

## Constraints

- Use asyncio for async operations
- Respect max concurrency limit
- Handle task errors gracefully
- Support task cancellation
- Track task status (pending, running, completed, failed)

Write your complete implementation below:

```python
import asyncio
from typing import Callable, Any, Optional
from enum import Enum

# Your implementation here
```

## Example Usage

```python
import asyncio

queue = AsyncTaskQueue(max_concurrency=3)

async def fetch_url(url):
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return await response.text()

for url in urls:
    queue.add(fetch_url(url))

await queue.run()
await queue.wait()
```

## Tests

```python
import asyncio

def test_add_single_task():
    async def _body():
        queue = AsyncTaskQueue(max_concurrency=2)

        async def task():
            return 42

        queue.add(task())
        assert queue.size() == 1
    asyncio.run(_body())

def test_run_single_task():
    async def _body():
        queue = AsyncTaskQueue(max_concurrency=2)

        result = None
        async def task():
            nonlocal result
            result = 42
            return result

        queue.add(task())
        await queue.run()
        await queue.wait()

        assert result == 42
    asyncio.run(_body())

def test_respect_concurrency_limit():
    async def _body():
        queue = AsyncTaskQueue(max_concurrency=2)
        running_count = 0
        max_running = 0

        async def task(delay):
            nonlocal running_count, max_running
            running_count += 1
            max_running = max(max_running, running_count)
            await asyncio.sleep(delay)
            running_count -= 1

        for _ in range(5):
            queue.add(task(0.1))

        await queue.run()
        await queue.wait()

        assert max_running <= 2
    asyncio.run(_body())

def test_track_completed_tasks():
    async def _body():
        queue = AsyncTaskQueue(max_concurrency=3)

        async def task():
            await asyncio.sleep(0.01)

        for _ in range(10):
            queue.add(task())

        assert queue.pending() == 10
        assert queue.completed() == 0

        await queue.run()
        await queue.wait()

        assert queue.completed() == 10
        assert queue.pending() == 0
    asyncio.run(_body())

def test_handle_task_errors():
    async def _body():
        queue = AsyncTaskQueue(max_concurrency=2)

        async def failing_task():
            raise ValueError("Task failed")

        async def success_task():
            return "success"

        queue.add(failing_task())
        queue.add(success_task())

        await queue.run()
        await queue.wait()

        # Should complete without crashing
        assert queue.completed() >= 1
    asyncio.run(_body())

def test_queue_size_tracking():
    async def _body():
        queue = AsyncTaskQueue(max_concurrency=3)

        async def task():
            await asyncio.sleep(0.01)

        for i in range(5):
            queue.add(task())
            assert queue.size() == i + 1

        await queue.run()
        await queue.wait()

        assert queue.size() == 0
    asyncio.run(_body())

def test_concurrent_execution():
    async def _body():
        queue = AsyncTaskQueue(max_concurrency=5)
        results = []

        async def task(value):
            await asyncio.sleep(0.01)
            results.append(value)
            return value

        for i in range(10):
            queue.add(task(i))

        start = asyncio.get_event_loop().time()
        await queue.run()
        await queue.wait()
        elapsed = asyncio.get_event_loop().time() - start

        # Should complete faster than sequential execution
        assert elapsed < 0.5
        assert len(results) == 10
    asyncio.run(_body())

def test_empty_queue():
    async def _body():
        queue = AsyncTaskQueue(max_concurrency=3)

        await queue.run()
        await queue.wait()

        assert queue.completed() == 0
    asyncio.run(_body())

def test_task_return_values():
    async def _body():
        queue = AsyncTaskQueue(max_concurrency=3)

        async def task(value):
            return value * 2

        tasks = [queue.add(task(i)) for i in range(5)]

        await queue.run()
        await queue.wait()

        # Tasks should have returned values
        assert len(tasks) == 5
    asyncio.run(_body())
```

## Solution

```python
import asyncio
from typing import Any, Coroutine


class Task:
    """A handle for a queued coroutine, so callers can find its result later."""

    def __init__(self, coro: Coroutine) -> None:
        self.coro = coro
        self.result: Any = None
        self.exception: BaseException | None = None
        self.done = False


class AsyncTaskQueue:
    def __init__(self, max_concurrency: int = 5) -> None:
        self.max_concurrency = max_concurrency
        self._tasks: list[Task] = []
        self._running: list[asyncio.Task] = []
        self._completed = 0
        # Created lazily: a Semaphore binds to the running loop, and the queue
        # is often constructed before that loop exists.
        self._semaphore: asyncio.Semaphore | None = None

    def add(self, coro: Coroutine) -> Task:
        task = Task(coro)
        self._tasks.append(task)
        return task

    def size(self) -> int:
        # What is left to do, not what was ever added: the queue is empty once
        # everything has run, which is what callers mean by size.
        return self.pending()

    def pending(self) -> int:
        return len(self._tasks) - self._completed

    def completed(self) -> int:
        return self._completed

    async def _execute(self, task: Task) -> None:
        assert self._semaphore is not None
        # Held for the whole coroutine, so at most max_concurrency of them are
        # ever between their first and last await.
        async with self._semaphore:
            try:
                task.result = await task.coro
            except BaseException as error:
                task.exception = error
            finally:
                task.done = True
                self._completed += 1

    async def run(self) -> None:
        self._semaphore = asyncio.Semaphore(self.max_concurrency)
        self._running = [asyncio.create_task(self._execute(task)) for task in self._tasks]

    async def wait(self) -> None:
        if self._running:
            await asyncio.gather(*self._running, return_exceptions=True)
            self._running = []
```
