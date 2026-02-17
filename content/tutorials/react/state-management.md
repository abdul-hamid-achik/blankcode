---
title: "State Management"
slug: "react-state-management"
description: "Learn patterns for managing complex state with useReducer, Context API, and composition"
track: "react"
order: 3
difficulty: "intermediate"
tags: ["state", "useReducer", "context", "lifting-state"]
---

# State Management

As your application grows, `useState` alone can become difficult to manage. This tutorial covers `useReducer` for predictable state transitions, Context for avoiding prop drilling, and composition patterns that keep your architecture clean.

## useReducer for Complex State

`useReducer` works well when state has multiple sub-values or the next state depends on the previous one:

```tsx
import { useReducer } from "react";

interface TodoState {
  todos: { id: number; text: string; done: boolean }[];
  nextId: number;
}

type TodoAction =
  | { type: "add"; text: string }
  | { type: "toggle"; id: number }
  | { type: "delete"; id: number };

function todoReducer(state: TodoState, action: TodoAction): TodoState {
  switch (action.type) {
    case "add":
      return {
        ...state,
        todos: [...state.todos, { id: state.nextId, text: action.text, done: false }],
        nextId: state.nextId + 1,
      };
    case "toggle":
      return {
        ...state,
        todos: state.todos.map((t) =>
          t.id === action.id ? { ...t, done: !t.done } : t
        ),
      };
    case "delete":
      return { ...state, todos: state.todos.filter((t) => t.id !== action.id) };
    default:
      return state;
  }
}

function TodoApp() {
  const [state, dispatch] = useReducer(todoReducer, { todos: [], nextId: 1 });

  return (
    <div>
      <h2>Todos ({state.todos.filter((t) => !t.done).length} remaining)</h2>
      <ul>
        {state.todos.map((todo) => (
          <li key={todo.id}>
            <span
              style={{ textDecoration: todo.done ? "line-through" : "none" }}
              onClick={() => dispatch({ type: "toggle", id: todo.id })}
            >
              {todo.text}
            </span>
            <button onClick={() => dispatch({ type: "delete", id: todo.id })}>Remove</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

The reducer is a pure function -- given the same state and action, it always returns the same result. This makes testing straightforward:

```typescript
// Testing reducers directly is simple -- call them with state and action:
const initial: TodoState = { todos: [], nextId: 1 };
const after = todoReducer(initial, { type: "add", text: "Learn React" });
// after.todos.length === 1
// after.nextId === 2
```

## Context API

Context passes data through the component tree without manually threading props at every level.

```tsx
import { createContext, useContext, useReducer } from "react";

interface AuthState {
  user: { id: string; name: string } | null;
  isAuthenticated: boolean;
}

type AuthAction = { type: "login"; user: AuthState["user"] } | { type: "logout" };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "login": return { user: action.user, isAuthenticated: true };
    case "logout": return { user: null, isAuthenticated: false };
    default: return state;
  }
}

const AuthContext = createContext<{
  state: AuthState;
  dispatch: React.Dispatch<AuthAction>;
} | null>(null);

function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, { user: null, isAuthenticated: false });
  return (
    <AuthContext.Provider value={{ state, dispatch }}>
      {children}
    </AuthContext.Provider>
  );
}
```

Consumers get a clean API through the custom hook:

```tsx
function UserMenu() {
  const { state, dispatch } = useAuth();

  if (!state.isAuthenticated) return <button>Log In</button>;

  return (
    <div>
      <span>Hello, {state.user?.name}</span>
      <button onClick={() => dispatch({ type: "logout" })}>Log Out</button>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <header><UserMenu /></header>
      <main>{/* app content */}</main>
    </AuthProvider>
  );
}
```

## Splitting State and Dispatch Contexts

For better performance, split state and dispatch into separate contexts. Components that only dispatch actions won't re-render when state changes:

```tsx
import { createContext, useContext, useReducer } from "react";

interface ExerciseState {
  exercises: { id: string; title: string; completed: boolean }[];
  selectedId: string | null;
}

type ExerciseAction =
  | { type: "select"; id: string }
  | { type: "complete"; id: string };

function exerciseReducer(state: ExerciseState, action: ExerciseAction): ExerciseState {
  switch (action.type) {
    case "select": return { ...state, selectedId: action.id };
    case "complete": return {
      ...state,
      exercises: state.exercises.map((ex) =>
        ex.id === action.id ? { ...ex, completed: true } : ex
      ),
    };
    default: return state;
  }
}

const initialState: ExerciseState = { exercises: [], selectedId: null };

const ExerciseStateCtx = createContext<ExerciseState | null>(null);
const ExerciseDispatchCtx = createContext<React.Dispatch<ExerciseAction> | null>(null);

function ExerciseProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(exerciseReducer, initialState);
  return (
    <ExerciseStateCtx.Provider value={state}>
      <ExerciseDispatchCtx.Provider value={dispatch}>
        {children}
      </ExerciseDispatchCtx.Provider>
    </ExerciseStateCtx.Provider>
  );
}
```

## Lifting State Up

Before reaching for Context, consider whether you can lift state to a common ancestor. This is often the simplest solution:

```tsx
import { useState } from "react";

interface Exercise {
  id: string;
  title: string;
}

function ExercisePage({ exercises }: { exercises: Exercise[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="exercise-page">
      <Sidebar exercises={exercises} selectedId={selectedId} onSelect={setSelectedId} />
      <MainPanel exerciseId={selectedId} />
    </div>
  );
}
```

Lifting state works well when only a few components share the data. When it needs to travel through many layers, Context is the better choice.

## When to Use External Libraries

The built-in tools handle most cases. Consider an external library when you need:

- **Server state caching** -- TanStack Query, SWR
- **Complex global state with many subscribers** -- Zustand, Jotai
- **Time-travel debugging** -- Redux Toolkit

For most applications, `useReducer` + Context provides everything you need.

## Practice

Try building a shopping cart using `useReducer` + Context with `add_item`, `remove_item`, and `update_quantity` actions.

Next up: [Advanced Patterns](/tutorials/react-advanced-patterns) for performance optimization, compound components, and code splitting.
