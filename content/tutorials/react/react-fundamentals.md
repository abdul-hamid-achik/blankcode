---
title: "React Fundamentals"
slug: "react-fundamentals"
description: "JSX compiles to function calls, components are functions that return them, and props are read-only — the three ideas everything else in React sits on."
track: "react"
order: 1
difficulty: "beginner"
tags: ["jsx", "components", "props", "events", "lists", "conditional-rendering"]
practice:
  concept: "state-and-events"
  label: "State and events"
---

React renders UI by re-running plain JavaScript functions and comparing what they return. Everything below is a consequence of that one sentence: JSX is not a template language, a component is not instantiated the way a class is, and a re-render is not something you request — it happens whenever state changes, and your job is to describe the result, not the steps to reach it.

## JSX compiles to function calls

JSX looks like HTML written inside JavaScript. It is not HTML — it's syntax sugar that a compiler (the JSX transform, a separate step from React itself) turns into function calls that build a tree of plain objects describing what should appear on screen. `<h1>Hello, world!</h1>` becomes roughly `jsx("h1", { children: "Hello, world!" })`. Nothing renders at that point; you get back a description, and React decides what to do with it later, during its own render pass.

```tsx
const greeting = <h1>Hello, world!</h1>;

const userCard = (
  <div className="card">
    <h2>Jane Doe</h2>
    <p>Software Engineer</p>
  </div>
);
```

Since React 17, the compiler imports what it needs from `react/jsx-runtime` on its own — the old requirement to write `import React from "react"` in every file using JSX, purely so `React.createElement` had something to call, is gone.

A JSX expression needs exactly one root node, because the underlying function call can only return one value. Use a fragment (`<>...</>`) when you need to return siblings without adding a wrapping `<div>` to the DOM. Anything inside curly braces is a plain JavaScript expression, evaluated and inserted where it sits:

```tsx
const name = "Alice";
const age = 28;

const bio = (
  <>
    <h1>Profile</h1>
    <p>{name} is {age} years old and has been coding for {age - 18} years.</p>
  </>
);
```

Curly braces take an expression, not a statement — `{if (x) { ... }}` is a syntax error inside JSX. That constraint is why conditional rendering later in this tutorial leans on `&&` and ternaries instead of `if`.

::code-blank{lang="tsx" href="/tracks/react/state-and-events" label="practice state and events for real"}
---
code: |
  const name = "Alice"
  const age = 28

  const bio = <p>{name} is {___blank_start___age___blank_end___} years old</p>
---
::

## Components are functions that return JSX

A component is a function that returns JSX. There is no lifecycle to hook into by inheriting from a base class and no instantiation step — React just calls the function again on the next render. The compiler decides, purely from the first letter, whether a JSX tag compiles to a DOM element string or a reference to your function. `<item />` compiles to an actual HTML element named "item," even with an `Item` component in scope; `<Item />` compiles to a call to it. Get the case wrong and nothing throws — the browser just renders a tag that was never meant to exist.

```tsx
function WelcomeBanner() {
  return (
    <div className="banner">
      <h1>Welcome to BlankCode</h1>
      <p>Learn to code by filling in the blanks.</p>
    </div>
  );
}

function App() {
  return (
    <main>
      <WelcomeBanner />
    </main>
  );
}
```

Composition is the whole model: `App` doesn't know or care how `WelcomeBanner` renders, only that it returns something JSX-shaped.

## Props are read-only inputs

Props pass data from a parent to a child, the same way arguments pass data into a function — because that's what they are. They are read-only: a component must never reassign a prop it received, only read it and derive new values.

```tsx
interface GreetingProps {
  name: string;
  role?: string;
}

function Greeting({ name, role = "student" }: GreetingProps) {
  return (
    <div>
      <h2>Hello, {name}!</h2>
      <p>Role: {role}</p>
    </div>
  );
}

function App() {
  return (
    <div>
      <Greeting name="Alice" role="instructor" />
      <Greeting name="Bob" />
    </div>
  );
}
```

Destructuring in the parameter list is where the default value lives (`role = "student"`), not inside the function body — that way a prop that's omitted entirely and a prop explicitly passed as `undefined` behave the same way.

The special `children` prop carries whatever JSX you nest between a component's tags. Type it as `React.ReactNode`, which covers strings, numbers, elements, fragments, and arrays of all of those — not `JSX.Element`, which is narrower than what `children` can actually hold:

```tsx
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <div className="card-body">{children}</div>
    </div>
  );
}

// <Card title="Exercise 1"><p>Fill in the blanks.</p></Card>
```

::code-blank{lang="tsx" href="/tracks/react/state-and-events" label="practice state and events for real"}
---
code: |
  function Panel({ label, children }: { label: string; children: React.___blank_start___ReactNode___blank_end___ }) {
    return <section>{children}</section>
  }
---
::

## Handling events

React wraps native browser events in a SyntheticEvent for cross-browser consistency, and names them in camelCase — `onClick`, not `onclick`. To pass an argument to a handler, wrap the call in an arrow function; passing `onClick={handleSelect(1)}` invokes it immediately during render, not on click.

```tsx
function ItemList() {
  function handleSelect(id: number) {
    console.log(`Selected item ${id}`);
  }

  return (
    <ul>
      <li onClick={() => handleSelect(1)}>Item 1</li>
      <li onClick={() => handleSelect(2)}>Item 2</li>
    </ul>
  );
}
```

If you learned React before 2020, one thing changed under you: events used to be pooled. React reused a single SyntheticEvent object across handlers and nulled its fields out asynchronously, so reading `event.target` inside a `setTimeout` returned `null` unless you called `event.persist()` first. React 17 removed pooling entirely — every event is its own object now, safe to read whenever you want. If you see `.persist()` in code you're reading, it's a harmless leftover; it does nothing today.

## Conditional rendering

Standard JavaScript operators handle conditional rendering. No special syntax exists for it, which is consistent with JSX being expressions, not a template language with its own control-flow directives.

```tsx
function Status({ isLoggedIn, username }: { isLoggedIn: boolean; username?: string }) {
  if (!isLoggedIn) {
    return <p>Please log in.</p>;
  }

  return (
    <div>
      <p>Welcome back, {username}!</p>
      {username === "admin" && <button>Admin Panel</button>}
      <span className={username ? "badge-active" : "badge-guest"}>
        {username ? "Member" : "Guest"}
      </span>
    </div>
  );
}
```

`&&` is the most common way to render something or nothing, and it has one sharp edge: everything left of `&&` gets evaluated, and if it's a falsy non-boolean, React renders it as text. `null`, `undefined`, and `false` render as nothing; `0` does not.

```tsx
// Bug: renders the text "0" when items is empty
{items.length && <List items={items} />}

// Fix: force a boolean
{items.length > 0 && <List items={items} />}
```

## Rendering lists with keys

`map()` turns an array of data into an array of elements. Every element in that array needs a `key` prop, and the purpose of `key` is not performance — it's identity. React uses it to match elements across renders to decide which DOM nodes to update, which to move, and which to throw away and recreate.

```tsx
interface Exercise {
  id: number;
  title: string;
  difficulty: string;
}

function ExerciseList({ exercises }: { exercises: Exercise[] }) {
  if (exercises.length === 0) {
    return <p>No exercises available yet.</p>;
  }

  return (
    <ul>
      {exercises.map((exercise) => (
        <li key={exercise.id}>
          <strong>{exercise.title}</strong>
          <span>{exercise.difficulty}</span>
        </li>
      ))}
    </ul>
  );
}
```

Using the array index as a key works only when the list never reorders, never filters, and never has items inserted anywhere but the end. Break any of those and the index-as-identity assumption breaks with it: React sees "the item at position 2 changed" rather than "a new item was inserted at position 0," and reuses the wrong DOM node — and the wrong component state — for the wrong piece of data. An uncontrolled `<input>` inside a reorderable list with index keys is the classic way to discover this: type into row two, delete row one, and your typed text is now attached to a different data item entirely.

::code-blank{lang="tsx" href="/tracks/react/state-and-events" label="practice state and events for real"}
---
code: |
  function TagList({ tags }: { tags: { id: string; label: string }[] }) {
    return (
      <ul>
        {tags.map((tag) => (
          <li ___blank_start___key___blank_end___={tag.id}>{tag.label}</li>
        ))}
      </ul>
    )
  }
---
::

## Where this bites

- **Index-as-key on a list that can reorder or filter.** Component state and uncontrolled inputs get silently reattached to the wrong data. Use a stable identifier from the data itself; only fall back to the index when the list is provably static.
- **`{count && <Badge />}` where `count` can be `0`.** The literal text "0" renders to the page instead of nothing. Force a boolean with a comparison (`count > 0 && ...`) or use a ternary with `null` on the other branch.
- **Reassigning a prop inside the component that received it.** Props are the read side of a one-way data flow; mutating one doesn't propagate anywhere useful and hides the actual source of truth. Copy it into local state if you need a component-owned, editable version.
- **A lowercase component name.** `<exerciseCard />` compiles to a literal HTML tag called "exercisecard," not a call to your `ExerciseCard` function, and nothing errors — it just silently isn't your component. Every component, even a small one defined inline, gets PascalCase.
