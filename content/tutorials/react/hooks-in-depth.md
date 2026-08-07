---
title: "Hooks in Depth"
slug: "react-hooks-in-depth"
description: "useState batches more aggressively than people expect, most useEffect calls solve a problem render could handle directly, and useContext re-renders every consumer on every change."
track: "react"
order: 2
difficulty: "intermediate"
tags: ["hooks", "useState", "useEffect", "custom-hooks", "useRef", "useContext"]
practice:
  concept: "advanced-hooks"
  label: "Advanced hooks"
---

Hooks let function components hold state and reach into React's internals without becoming classes. The call signatures are the easy part; what's worth a full tutorial is the behavior underneath — when React batches your updates, when an effect is actually the right tool, and why the convenient parts of `useContext` have a re-render cost nobody mentions in the two-line example.

## useState: batching and the updater function

`useState` returns the current value and a setter; calling the setter schedules a re-render with the new value. What trips people up is batching: React groups multiple state updates that happen inside the same event handler — and since React 18, inside promises, timeouts, and native event handlers too — into a single re-render, and within that batch, every setter call sees the same snapshot of state, not the value from the previous call in the same batch.

```tsx
function Counter() {
  const [count, setCount] = useState(0);

  function handleDoubleIncrement() {
    setCount(count + 1);
    setCount(count + 1);
  }

  return <button onClick={handleDoubleIncrement}>Count: {count}</button>;
}
```

Click that button once and `count` goes up by one, not two — both calls close over the same `count` from the render that created `handleDoubleIncrement`. The updater function form fixes it, because each call receives the pending state rather than the state from the render:

```tsx
function handleDoubleIncrement() {
  setCount((prev) => prev + 1);
  setCount((prev) => prev + 1);
}
```

Default to the updater form whenever the next state depends on the current one. It costs nothing when there's only one call, and it's the difference between correct and wrong when there's more than one.

::code-blank{lang="tsx" href="/tracks/react/advanced-hooks" label="practice advanced hooks for real"}
---
code: |
  function handleBonus() {
    setScore((___blank_start___prev___blank_end___) => prev + 10)
  }
---
::

## useEffect: what actually deserves one

`useEffect` synchronizes a component with something outside React — a subscription, a DOM measurement, a timer, a WebSocket connection. That's a narrower job than most codebases use it for. If you can compute a value directly from props or state while rendering, do that instead of pushing it through an effect and a second state variable; the effect version costs an extra render — state starts stale, then the effect fires and updates it — for no benefit.

```tsx
// Unnecessary: an effect just to derive a value that's already available
function Bad({ items }: { items: string[] }) {
  const [count, setCount] = useState(0);
  useEffect(() => setCount(items.length), [items]);
  return <p>{count} items</p>;
}

// Direct: no effect, no extra render, no stale frame
function Good({ items }: { items: string[] }) {
  return <p>{items.length} items</p>;
}
```

When an effect is the right call — fetching on mount, subscribing to something external — the dependency array controls when it re-runs, and the cleanup function, the value the callback returns, runs before the next execution and on unmount:

```tsx
function ExerciseLoader({ trackId }: { trackId: string }) {
  const [exercises, setExercises] = useState<{ id: number; title: string }[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/tracks/${trackId}/exercises`, { signal: controller.signal })
      .then((res) => res.json())
      .then(setExercises)
      .catch((err) => { if (err.name !== "AbortError") throw err; });
    return () => controller.abort();
  }, [trackId]);

  return <ul>{exercises.map((ex) => <li key={ex.id}>{ex.title}</li>)}</ul>;
}
```

The callback itself can't be `async` — an async function returns a promise, and React expects either nothing or a cleanup function back, not a promise it doesn't know how to await. Define the async logic inside the effect and call it, as the `fetch().then()` chain above does, or write a nested async function and invoke it immediately.

::code-blank{lang="tsx" href="/tracks/react/advanced-hooks" label="practice advanced hooks for real"}
---
code: |
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth)
    window.addEventListener("resize", handleResize)
    ___blank_start___return___blank_end___ () => window.removeEventListener("resize", handleResize)
  }, [])
---
::

## useRef: the escape hatch from re-renders

`useRef` holds a mutable value across renders without triggering one when it changes. Two genuinely different use cases share the API: holding a reference to a DOM node, and holding an instance variable — a timer ID, a previous value, a flag — that the component needs to remember but never needs to display.

```tsx
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

Reading or writing `.current` during render is unsafe — React doesn't know it happened, so nothing re-renders when it changes, and under concurrent rendering a render can be thrown away and retried, leaving a ref mutated for a render that never committed. Refs are for event handlers and effects, not the render body itself.

## useContext: convenient, and re-renders everything

`useContext` reads a value from the nearest matching `Provider` above it, which is how you avoid threading a prop through five layers that don't use it.

```tsx
const ThemeContext = createContext<Theme>({ primary: "#3b82f6", background: "#fff" });

function ThemedButton() {
  const theme = useContext(ThemeContext);
  return <button style={{ backgroundColor: theme.primary }}>Click Me</button>;
}
```

::code-blank{lang="tsx" href="/tracks/react/advanced-hooks" label="practice advanced hooks for real"}
---
code: |
  function LocaleLabel() {
    const locale = ___blank_start___useContext___blank_end___(LocaleContext)
    return <span>{locale}</span>
  }
---
::

The part that surprises people once an app has grown: every component that calls `useContext` on a given context re-renders whenever that context's value changes, in full — there's no built-in way to subscribe to just the field you read. Pass a new object literal as the `value` prop and every consumer re-renders on every parent render, whether or not the fields they actually use changed:

```tsx
// New object every render — every consumer re-renders every time App does
<ThemeContext.Provider value={{ primary, background }}>

// Stable reference unless primary or background actually changed
const value = useMemo(() => ({ primary, background }), [primary, background]);
<ThemeContext.Provider value={value}>
```

For state that changes often and is read by many components, split it into two contexts — one for the value, one for the setter or dispatch — so components that only dispatch actions don't re-render when the value does.

## Writing custom hooks

A custom hook is a function whose name starts with `use` and that calls other hooks. That naming convention isn't cosmetic — it tells the linter, and the next person reading the code, that the two rules of hooks apply: call hooks only at the top level, never inside a condition, loop, or nested function, and call them only from components or other hooks. React tracks hook state by the order calls happen in during a render, not by name, so a hook call that sometimes runs and sometimes doesn't shifts every hook after it to the wrong slot.

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

A good custom hook earns its name by hiding something genuinely reusable — a debounce timer, a subscription lifecycle, a piece of derived logic used in three places — not by wrapping a single `useState` call for the sake of having a hook.

## Where this bites

- **An effect with an incomplete dependency array.** Omitting a value the effect reads doesn't make the effect stop needing it — it makes the effect read a stale closure of it instead. Include every reactive value the effect uses; if that triggers a loop, the loop is telling you the effect is structured wrong, not that the array is.
- **Deriving state from props with an effect plus a second `useState`.** It costs an extra render where the UI shows stale data, and the value was already computable without either. Compute it as a plain expression during render, or `useMemo` it if the computation is expensive.
- **A fresh object literal passed as a context `value`.** Every consumer re-renders on every parent render regardless of whether the fields they read changed, because there's no partial subscription to a context. Memoize the value, or split frequently-changing state into its own context.
- **A hook called after an early return or inside an `if`.** React matches hook state to hook calls by position, so a conditional hook shifts every later hook to the wrong slot on renders where the condition differs. Always call hooks unconditionally at the top; move the condition inside the hook body instead.
