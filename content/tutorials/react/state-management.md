---
title: "State Management"
slug: "react-state-management"
description: "useReducer, Context, and lifting state up cover nearly everything client state needs — the real argument for a state library is usually about caching server data, not about React running out of room."
track: "react"
order: 3
difficulty: "intermediate"
tags: ["state", "useReducer", "context", "lifting-state"]
practice:
  concept: "state-and-events"
  label: "State and events"
---

"State management" gets treated as a library decision before it's understood as a design decision. The built-in tools — `useState`, `useReducer`, Context, and lifting state to a common ancestor — handle the overwhelming majority of what applications need. This tutorial covers when each one is the right level of abstraction, and closes with the actual reason teams reach for something more: it's rarely because React "can't scale," it's because they're modeling a problem client state was never meant to solve.

## useReducer: when actions beat setters

`useState` scales fine until a piece of state has several sub-values that change together, or the next state depends on nontrivial logic rather than a single new value. At that point a pile of `setX` calls scattered across handlers becomes harder to reason about than one function that takes the current state and an action and returns the next state.

```tsx
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
        todos: state.todos.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t)),
      };
    case "delete":
      return { ...state, todos: state.todos.filter((t) => t.id !== action.id) };
  }
}

function TodoApp() {
  const [state, dispatch] = useReducer(todoReducer, { todos: [], nextId: 1 });

  return (
    <ul>
      {state.todos.map((todo) => (
        <li key={todo.id} onClick={() => dispatch({ type: "toggle", id: todo.id })}>
          {todo.text}
        </li>
      ))}
    </ul>
  );
}
```

The reducer itself is a pure function — same state and action in, same state out, no side effects — which is what makes it worth extracting. You can test `todoReducer({ todos: [], nextId: 1 }, { type: "add", text: "Learn React" })` directly, with no component, no rendering, and no mocking.

::code-blank{lang="tsx" href="/tracks/react/state-and-events" label="practice state and events for real"}
---
code: |
  dispatch({ ___blank_start___type___blank_end___: "reset" })
---
::

## Colocate state, don't centralize it

Before reaching for Context, check whether the state can just live one level higher. Lifting state to the nearest common ancestor and passing it down as props is often the entire solution, and it keeps the data flow visible in the function signatures instead of implicit in a provider tree.

```tsx
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

This works cleanly for a couple of levels. It stops working cleanly when the state needs to reach five components down through three that don't use it — that's the actual signal for Context, not "two components need to share something."

::code-blank{lang="tsx" href="/tracks/react/state-and-events" label="practice state and events for real"}
---
code: |
  function ExerciseBrowser({ exercises }: { exercises: Exercise[] }) {
    const [activeId, setActiveId] = useState<string | null>(null)

    return <Sidebar exercises={exercises} activeId={activeId} onSelect={___blank_start___setActiveId___blank_end___} />
  }
---
::

## Context: for data that's read often and written rarely

Context solves prop drilling by letting distant descendants read a value without every component in between passing it through. It fits data that changes infrequently and gets read broadly: the authenticated user, the active theme, the current locale.

```tsx
interface AuthState {
  user: { id: string; name: string } | null;
  isAuthenticated: boolean;
}

type AuthAction = { type: "login"; user: AuthState["user"] } | { type: "logout" };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "login": return { user: action.user, isAuthenticated: true };
    case "logout": return { user: null, isAuthenticated: false };
  }
}

const AuthContext = createContext<{ state: AuthState; dispatch: React.Dispatch<AuthAction> } | null>(null);

function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, { user: null, isAuthenticated: false });
  return <AuthContext.Provider value={{ state, dispatch }}>{children}</AuthContext.Provider>;
}
```

Every consumer of a context re-renders when its value changes, with no partial subscription — a component reading only `state.user` still re-renders when unrelated fields in the same value change. For state that's written often, split the state and the dispatch function into two separate contexts; components that only dispatch actions never need to re-render when the state they don't read changes:

```tsx
const ExerciseStateCtx = createContext<ExerciseState | null>(null);
const ExerciseDispatchCtx = createContext<React.Dispatch<ExerciseAction> | null>(null);
```

::code-blank{lang="tsx" href="/tracks/react/state-and-events" label="practice state and events for real"}
---
code: |
  function useTheme() {
    const ctx = useContext(ThemeContext)
    if (!ctx) throw new Error("useTheme must be used within ThemeProvider")
    return ___blank_start___ctx___blank_end___
  }
---
::

## When the built-in tools stop being the answer

Most of what gets labeled a "state management problem" is actually a server state problem wearing client state's clothes: data that lives on a server, that multiple components need, that can go stale, and that might be requested twice at once. `useReducer` and Context can hold that data, but they don't know anything about caching, deduplicating in-flight requests, retrying, or revalidating on refocus — you'd write all of that by hand, badly, on top of a `useEffect`. That's the actual argument for TanStack Query or SWR: not that Context "doesn't scale," but that server state and client state are different problems with different correct solutions.

For state that's genuinely client-side — UI state read and written from many unrelated places, with no natural common ancestor — Zustand or Jotai remove the provider-tree ceremony and the re-render-everything default that plain Context has. Reach for Redux Toolkit specifically when you need time-travel debugging or a large team needs the enforced structure; for most applications, `useReducer` plus Context, applied at the right scope, is the whole answer.

## Where this bites

- **Reaching for Context the moment two components need to share something.** Lifting state to their common ancestor and passing props down is usually simpler and keeps the data flow explicit. Context earns its place when the data needs to skip several layers that don't use it, not to avoid two prop declarations.
- **Putting state that changes on every keystroke or every frame into Context.** Every consumer re-renders on every change with no way to subscribe to a slice of the value. Keep hot-changing state local, or isolate it in its own context that most of the tree doesn't consume.
- **Hand-rolling data fetching and caching with `useReducer` and an effect.** It quietly re-implements request deduplication, retry, and staleness tracking, usually incompletely. Treat data that lives on a server as a different problem and reach for a library built for it.
- **One reducer or context that owns unrelated concerns.** Auth, theme, and exercise progress living in the same provider means an update to any one of them re-renders every consumer of the whole thing. Split by concern into separate reducers and contexts scoped to where they're actually used.
