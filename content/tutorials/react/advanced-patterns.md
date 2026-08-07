---
title: "Advanced Patterns"
slug: "react-advanced-patterns"
description: "memo, useMemo, compound components, code splitting, and error boundaries — what each one actually buys you, and the specific case where reaching for it makes things worse instead of faster."
track: "react"
order: 4
difficulty: "advanced"
tags: ["patterns", "performance", "composition", "memo", "code-splitting", "compound-components"]
practice:
  concept: "performance-and-patterns"
  label: "Performance and patterns"
---

These patterns are for a codebase that already works — they trade simplicity for a specific property: fewer re-renders, a more flexible component API, a smaller initial bundle, or a contained failure. Every one of them has a cost, and the skill this tutorial is teaching is knowing which side of the trade you're on before you reach for one.

## memo and useCallback: pay for what you profile

`React.memo` wraps a component so it skips re-rendering when its props are shallow-equal to last time. It only helps when two things are both true: the props really are stable across renders, and the render being skipped is expensive enough to matter. Neither is guaranteed by wrapping something in `memo` — the comparison itself has a cost, and a single unstable prop defeats it completely.

```tsx
const ExerciseCard = memo(function ExerciseCard({
  id, title, difficulty, onSelect,
}: {
  id: string; title: string; difficulty: string; onSelect: (id: string) => void;
}) {
  return (
    <div className="exercise-card" onClick={() => onSelect(id)}>
      <h3>{title}</h3>
      <span>{difficulty}</span>
    </div>
  );
});

function ExerciseList() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const handleSelect = useCallback((id: string) => setSelectedId(id), []);
  // ...
}
```

::code-blank{lang="tsx" href="/tracks/react/performance-and-patterns" label="practice performance and patterns for real"}
---
code: |
  const TrackRow = ___blank_start___memo___blank_end___(function TrackRow({ name }: { name: string }) {
    return <li>{name}</li>
  })
---
::

`memo` compares props with `Object.is`, so an inline object, array, or arrow function passed as a prop is a new reference every render and breaks the comparison silently — no warning, the memoization just does nothing. `useCallback` and `useMemo` exist to stabilize those references for exactly this case. None of this is worth doing without profiling first: React DevTools' Profiler tells you which components are actually re-rendering expensively, and in React 19, the React Compiler applies this kind of memoization automatically wherever it can statically prove it's safe — hand-written `memo`/`useCallback` is increasingly there for the cases the compiler can't yet reach, not a default habit.

## useMemo: for calculations, not for the linter

`useMemo` recomputes a value only when its dependencies change, caching the result between renders. It's for computation that's actually expensive — filtering or aggregating a large array, something with real algorithmic cost — not for every derived value on principle. A cheap calculation wrapped in `useMemo` still pays the cost of the dependency comparison and the closure, for a save that was never worth making.

```tsx
function SubmissionStats({ submissions }: { submissions: { status: string }[] }) {
  const stats = useMemo(() => {
    const passed = submissions.filter((s) => s.status === "passed").length;
    const failed = submissions.filter((s) => s.status === "failed").length;
    return { passed, failed, passRate: submissions.length > 0 ? (passed / submissions.length) * 100 : 0 };
  }, [submissions]);

  return <div>Pass rate: {stats.passRate.toFixed(1)}%</div>;
}
```

::code-blank{lang="tsx" href="/tracks/react/performance-and-patterns" label="practice performance and patterns for real"}
---
code: |
  const summary = useMemo(() => summarize(attempts), [___blank_start___attempts___blank_end___])
---
::

## Compound components

Compound components share implicit state through Context so a group of components can be composed freely while still coordinating with each other — `Tabs`, `Tab`, and `TabPanel` below don't take an `activeTab` prop each; they all read it from one shared provider.

```tsx
const TabsContext = createContext<{ activeTab: string; setActiveTab: (id: string) => void } | null>(null);

function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tab components must be used within Tabs");
  return ctx;
}

function Tabs({ defaultTab, children }: { defaultTab: string; children: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  return <TabsContext.Provider value={{ activeTab, setActiveTab }}>{children}</TabsContext.Provider>;
}

function Tab({ id, children }: { id: string; children: React.ReactNode }) {
  const { activeTab, setActiveTab } = useTabs();
  return (
    <button className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)}>
      {children}
    </button>
  );
}
```

The trade is the same one Context always makes: a flexible, discoverable-through-JSX API in exchange for implicit coupling and no partial subscription. Every `Tab` and `TabPanel` re-renders whenever `activeTab` changes, including the ones whose own rendered output doesn't depend on it, because they all read the same context value. That's a reasonable price for a genuinely reusable UI primitive like tabs or an accordion; it's a bad trade for a one-off internal component that would be simpler with two or three explicit props.

## Custom hook patterns for async state

A well-designed custom hook hides a state machine behind a simple return value. `useAsync` below tracks loading, data, and error for any async function, and uses a ref rather than a dependency array entry to always call the latest version of the function without re-triggering effects when it changes identity between renders:

```tsx
function useAsync<T>(asyncFn: () => Promise<T>) {
  const [state, setState] = useState<{ data: T | null; error: Error | null; loading: boolean }>({
    data: null, error: null, loading: false,
  });
  const fnRef = useRef(asyncFn);
  fnRef.current = asyncFn;

  const execute = useCallback(async () => {
    setState({ data: null, error: null, loading: true });
    try {
      const data = await fnRef.current();
      setState({ data, error: null, loading: false });
    } catch (error) {
      setState({ data: null, error: error as Error, loading: false });
    }
  }, []);

  return { ...state, execute };
}
```

Assigning `fnRef.current = asyncFn` directly in the render body, not inside an effect, is deliberate: it's a plain mutation with no reactive consequence, so it's safe to do unconditionally on every render, and it's what lets `execute`'s identity stay stable via the empty dependency array in `useCallback` while still calling whichever version of `asyncFn` was passed most recently.

## Code splitting with lazy and Suspense

`React.lazy` defers loading a component's code until it's first rendered, which keeps it out of the initial bundle. `Suspense` shows a fallback while the lazy import is in flight:

```tsx
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Exercise = lazy(() => import("./pages/Exercise"));

function AppRoutes() {
  return (
    <Suspense fallback={<div className="page-loader">Loading...</div>}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/exercise/:id" element={<Exercise />} />
      </Routes>
    </Suspense>
  );
}
```

::code-blank{lang="tsx" href="/tracks/react/performance-and-patterns" label="practice performance and patterns for real"}
---
code: |
  const Settings = ___blank_start___lazy___blank_end___(() => import("./pages/Settings"))
---
::

Suspense only handles the pending state. A failed dynamic import — a network blip, or a deploy that shipped a new chunk hash while a user's tab was still open on the old one — throws during render, and Suspense has no answer for a throw. That's what error boundaries are for, and lazy routes should always be wrapped in both.

## Error boundaries

When a component throws during render, React unmounts the entire tree below the nearest error boundary by default. Error boundaries are the one place a class component is still required — there's no hook equivalent for `getDerivedStateFromError` or `componentDidCatch`:

```tsx
class ErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Render error:", error, info.componentStack);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
```

They catch errors in rendering, lifecycle methods, and constructors of the tree below them. They do not catch errors in event handlers, in async code, or during server-side rendering — those need an ordinary try/catch at the point they can occur.

## Where this bites

- **Wrapping a component in `memo` without profiling first.** The comparison itself has a cost, and if the render wasn't expensive or the props weren't stable, you've added overhead for nothing measurable. Profile with React DevTools before memoizing, and remember React 19's compiler already does this automatically wherever it safely can.
- **Passing an inline object, array, or arrow function to a memoized component.** It's a new reference every render, so `memo`'s comparison fails every time and the wrap does nothing — silently, with no warning. Stabilize the prop with `useMemo` or `useCallback`, or lift the literal out of the render function entirely.
- **Reaching for compound components and Context for a two- or three-prop component.** It trades a typed, discoverable prop API for implicit coupling to sibling markup and a context every child re-renders on. Save the pattern for genuinely composable UI kits — tabs, accordions, menus — not one-off internal components.
- **A lazy route wrapped in `Suspense` but not an error boundary.** `Suspense` only handles the pending state; a failed dynamic import throws during render and unmounts the tree with a blank screen instead of a retry UI. Pair every lazy boundary with an error boundary above or around it.
