---
title: "React Fundamentals"
slug: "react-fundamentals"
description: "Learn the core building blocks of React including JSX, components, props, and event handling"
track: "react"
order: 1
difficulty: "beginner"
tags: ["jsx", "components", "props", "events", "lists", "conditional-rendering"]
---

# React Fundamentals

React is a JavaScript library for building user interfaces through composable components. This tutorial covers the foundational concepts you need to start building with React.

## JSX Syntax

JSX lets you write HTML-like syntax directly in your JavaScript. Under the hood, JSX is transformed into function calls that create element descriptions. Since React 17, this happens automatically without needing to import React.

```tsx
const greeting = <h1>Hello, world!</h1>;

const userCard = (
  <div className="card">
    <h2>Jane Doe</h2>
    <p>Software Engineer</p>
  </div>
);
```

JSX expressions must have a single root element. Use fragments (`<>...</>`) to group elements without extra DOM nodes. Embed JavaScript expressions inside JSX with curly braces:

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

## Functional Components

Components are reusable pieces of UI. In modern React, components are functions that return JSX. Component names must start with an uppercase letter.

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

## Props

Props let you pass data from a parent component to a child. They work like function arguments and are read-only.

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

The special `children` prop lets you pass JSX between a component's tags:

```tsx
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <div className="card-body">{children}</div>
    </div>
  );
}

function App() {
  return (
    <Card title="Exercise 1">
      <p>Fill in the blanks to complete the component.</p>
      <button>Start</button>
    </Card>
  );
}
```

## Handling Events

React uses camelCase event names and passes functions as handlers. To pass arguments, wrap the handler in an arrow function:

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

## Conditional Rendering

Use standard JavaScript operators to conditionally render elements:

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

**Pitfall: falsy values in `&&` expressions.** When using `&&` for conditional rendering, be careful with falsy values like `0`. Unlike `null`, `undefined`, or `false`, the number `0` will actually render to the DOM:

```tsx
// Bug: renders "0" when items is empty
{items.length && <List items={items} />}

// Fix: use an explicit boolean comparison
{items.length > 0 && <List items={items} />}
```

## Rendering Lists with Keys

Use `map()` to render arrays. Every list item needs a unique `key` prop so React can track changes efficiently. Never use array indices as keys if the list can be reordered.

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

## Putting It All Together

```tsx
interface Track {
  id: string;
  name: string;
  exerciseCount: number;
  completed: boolean;
}

function TrackCard({ track }: { track: Track }) {
  return (
    <div className="track-card">
      <h3>{track.name}</h3>
      <p>{track.exerciseCount} exercises</p>
      {track.completed ? (
        <span className="badge">Completed</span>
      ) : (
        <button onClick={() => console.log(`Starting ${track.id}`)}>Start</button>
      )}
    </div>
  );
}

function TrackList({ tracks }: { tracks: Track[] }) {
  return (
    <div className="track-list">
      {tracks.map((track) => (
        <TrackCard key={track.id} track={track} />
      ))}
    </div>
  );
}
```

## Practice

You now know the essentials: JSX, components, props, events, conditional rendering, and lists. These concepts form the foundation of every React application.

Next up: [Hooks in Depth](/tutorials/react-hooks-in-depth)
