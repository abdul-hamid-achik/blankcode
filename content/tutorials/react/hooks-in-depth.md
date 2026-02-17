---
title: "Hooks in Depth"
slug: "react-hooks-in-depth"
description: "Master React hooks including useState, useEffect, useRef, useContext, and custom hooks"
track: "react"
order: 2
difficulty: "intermediate"
tags: ["hooks", "useState", "useEffect", "custom-hooks", "useRef", "useContext"]
---

# Hooks in Depth

Hooks let you use state and other React features in functional components. This tutorial covers the most important built-in hooks and shows you how to write your own.

## useState

`useState` declares a state variable. When state changes, React re-renders the component.

```tsx
import { useState } from "react";

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(prev => prev + 1)}>Increment</button>
      <button onClick={() => setCount(0)}>Reset</button>
    </div>
  );
}
```

When the next state depends on the previous state, use the updater function form. For objects and arrays, always create new references instead of mutating:

```tsx
function ProfileForm() {
  const [form, setForm] = useState({ name: "", email: "" });

  return (
    <form>
      <input
        value={form.name}
        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
      />
      <input
        value={form.email}
        onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
      />
    </form>
  );
}
```

## useEffect

`useEffect` runs side effects after render. The dependency array controls when it re-runs: `[]` for once, `[a, b]` when values change, or no array for every render.

**Important:** The callback passed to `useEffect` cannot be `async`. If you need to use `await`, define an async function inside the effect and call it.

```tsx
import { useState, useEffect } from "react";

function ExerciseLoader({ trackId }: { trackId: string }) {
  const [exercises, setExercises] = useState<{ id: number; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/tracks/${trackId}/exercises`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => { setExercises(data); setLoading(false); })
      .catch((err) => { if (err.name !== 'AbortError') setError(err); });
    return () => controller.abort();
  }, [trackId]);

  if (loading) return <p>Loading exercises...</p>;
  return (
    <ul>
      {exercises.map((ex) => <li key={ex.id}>{ex.title}</li>)}
    </ul>
  );
}
```

Return a cleanup function to prevent memory leaks with listeners, timers, and subscriptions:

```tsx
function WindowSize() {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return <p>Window width: {width}px</p>;
}
```

## useRef

`useRef` holds a mutable value that persists across renders without causing re-renders. Common uses include accessing DOM elements and storing timer IDs:

```tsx
import { useRef, useState, useEffect } from "react";

function Stopwatch() {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function start() {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => setSeconds((p) => p + 1), 1000);
  }

  function stop() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }

  useEffect(() => () => stop(), []);

  return (
    <div>
      <input ref={inputRef} placeholder="Label" />
      <p>{seconds}s</p>
      <button onClick={start}>Start</button>
      <button onClick={stop}>Stop</button>
    </div>
  );
}
```

## useContext

`useContext` reads a value from a React context, sharing data across the tree without prop drilling:

```tsx
import { createContext, useContext } from "react";

interface Theme { primary: string; background: string }

const ThemeContext = createContext<Theme>({ primary: "#3b82f6", background: "#fff" });

function ThemedButton() {
  const theme = useContext(ThemeContext);
  return (
    <button style={{ backgroundColor: theme.primary, color: "#fff" }}>
      Click Me
    </button>
  );
}

function App() {
  const dark: Theme = { primary: "#8b5cf6", background: "#1a1a2e" };
  return (
    <ThemeContext.Provider value={dark}>
      <ThemedButton />
    </ThemeContext.Provider>
  );
}
```

## Rules of Hooks

Two rules that must always be followed:

1. **Only call hooks at the top level.** Never inside loops, conditions, or nested functions.
2. **Only call hooks from React functions.** Use them in components or custom hooks, not regular functions.

```tsx
// Wrong: conditional hook
function Bad({ show }: { show: boolean }) {
  if (show) { const [v, setV] = useState(""); } // breaks rules
  return <div />;
}

// Correct: always call, conditionally render
function Good({ show }: { show: boolean }) {
  const [v, setV] = useState("");
  return <div>{show && <p>{v}</p>}</div>;
}
```

## Writing Custom Hooks

Custom hooks extract reusable stateful logic. A custom hook is any function starting with `use`:

```tsx
function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}
```

Here's a debounce hook that waits for the user to stop typing:

```tsx
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function SearchExercises() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery) console.log(`Searching: ${debouncedQuery}`);
  }, [debouncedQuery]);

  return <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search..." />;
}
```

## Practice

You now have a solid grasp of the core React hooks. Next up: [State Management](/tutorials/react-state-management) patterns with `useReducer` and Context.
