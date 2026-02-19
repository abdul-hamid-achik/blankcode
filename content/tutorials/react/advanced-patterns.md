---
title: "Advanced Patterns"
slug: "react-advanced-patterns"
description: "Master performance optimization, compound components, custom hooks, and code splitting in React."
track: "react"
order: 4
difficulty: "advanced"
tags: ["patterns", "performance", "composition", "memo", "code-splitting", "compound-components"]
---

# Advanced Patterns

Once you're comfortable with hooks and state management, these patterns will help you write more performant, composable, and maintainable React code.

## React.memo and useCallback

`React.memo` prevents re-renders when props haven't changed. Pair it with `useCallback` to keep function references stable:

```tsx
import { memo, useState, useCallback } from "react";

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

  const exercises = [
    { id: "1", title: "Variables", difficulty: "beginner" },
    { id: "2", title: "Functions", difficulty: "beginner" },
  ];

  return (
    <div>
      <p>Selected: {selectedId}</p>
      {exercises.map((ex) => (
        <ExerciseCard key={ex.id} {...ex} onSelect={handleSelect} />
      ))}
    </div>
  );
}
```

Without `useCallback`, the arrow function creates a new reference each render, defeating `memo`.

**Important:** Always profile before memoizing. `React.memo` and `useMemo` add overhead themselves -- they only pay off when re-renders are genuinely expensive. Use React DevTools Profiler to identify actual bottlenecks before reaching for these tools.

## useMemo

`useMemo` memoizes expensive computations so they only recalculate when dependencies change:

```tsx
import { useMemo } from "react";

function SubmissionStats({ submissions }: { submissions: { status: string }[] }) {
  const stats = useMemo(() => {
    const passed = submissions.filter((s) => s.status === "passed").length;
    const failed = submissions.filter((s) => s.status === "failed").length;
    const rate = submissions.length > 0 ? (passed / submissions.length) * 100 : 0;
    return { passed, failed, passRate: rate.toFixed(1) };
  }, [submissions]);

  return (
    <div className="stats">
      <div>Passed: {stats.passed}</div>
      <div>Failed: {stats.failed}</div>
      <div>Pass rate: {stats.passRate}%</div>
    </div>
  );
}
```

Only use `useMemo` when the computation is genuinely expensive or you need referential stability.

## Compound Components

Compound components share implicit state through Context, giving consumers a flexible API:

```tsx
import { createContext, useContext, useState } from "react";

const TabsContext = createContext<{
  activeTab: string;
  setActiveTab: (id: string) => void;
} | null>(null);

function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tab components must be used within Tabs");
  return ctx;
}

function Tabs({ defaultTab, children }: { defaultTab: string; children: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className="tabs">{children}</div>
    </TabsContext.Provider>
  );
}

function Tab({ id, children }: { id: string; children: React.ReactNode }) {
  const { activeTab, setActiveTab } = useTabs();
  return (
    <button className={activeTab === id ? "tab active" : "tab"} onClick={() => setActiveTab(id)}>
      {children}
    </button>
  );
}

function TabPanel({ id, children }: { id: string; children: React.ReactNode }) {
  const { activeTab } = useTabs();
  if (activeTab !== id) return null;
  return <div className="tab-panel">{children}</div>;
}
```

Usage is clean and composable:

```tsx
function ExercisePage() {
  return (
    <Tabs defaultTab="description">
      <div role="tablist">
        <Tab id="description">Description</Tab>
        <Tab id="submissions">Submissions</Tab>
      </div>
      <TabPanel id="description"><p>Fill in the blanks...</p></TabPanel>
      <TabPanel id="submissions"><SubmissionHistory /></TabPanel>
    </Tabs>
  );
}
```

## Custom Hook Patterns

Well-designed custom hooks encapsulate complex logic behind a simple interface:

```tsx
import { useState, useCallback, useRef } from "react";

function useAsync<T>(asyncFn: () => Promise<T>) {
  const [state, setState] = useState<{ data: T | null; error: Error | null; loading: boolean }>({ data: null, error: null, loading: false });
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

function SubmitButton({ exerciseId, code }: { exerciseId: string; code: string }) {
  const { loading, error, execute } = useAsync(
    () => fetch(`/api/exercises/${exerciseId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }).then((r) => r.json()),
  );

  return (
    <div>
      <button onClick={execute} disabled={loading}>
        {loading ? "Submitting..." : "Submit"}
      </button>
      {error && <p className="error">{error.message}</p>}
    </div>
  );
}
```

## Code Splitting with lazy and Suspense

`React.lazy` loads components on demand, reducing initial bundle size. `Suspense` shows a fallback while loading:

```tsx
import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Exercise = lazy(() => import("./pages/Exercise"));
const Profile = lazy(() => import("./pages/Profile"));

function AppRoutes() {
  return (
    <Suspense fallback={<div className="page-loader">Loading...</div>}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/exercise/:id" element={<Exercise />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </Suspense>
  );
}
```

## Error Boundaries

When a component throws during rendering, React unmounts the entire tree by default. Error boundaries catch render errors and display a fallback UI. They are the only React feature that still requires a class component:

```tsx
import { Component, ErrorInfo, ReactNode } from "react";

class ErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Render error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// Wrap lazy-loaded routes or any subtree that might fail:
function App() {
  return (
    <ErrorBoundary fallback={<p>Something went wrong. Please refresh.</p>}>
      <AppRoutes />
    </ErrorBoundary>
  );
}
```

Error boundaries catch errors in rendering, lifecycle methods, and constructors of the tree below them. They do **not** catch errors in event handlers, async code, or server-side rendering -- use try/catch for those.

## Practice

These patterns are tools, not rules. Choose based on your situation:
- `memo` + `useCallback` when profiling shows unnecessary re-renders
- Compound components for reusable UI kits
- Custom hooks to share stateful logic
- Code splitting when bundle size becomes a concern
- Error boundaries around lazy-loaded routes and unreliable subtrees

Head to the [React track](/tracks/react) to practice these patterns in interactive exercises.
