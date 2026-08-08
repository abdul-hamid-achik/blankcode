---
slug: re-review-001
title: 'Review: a reducer that mutates, and a UI that stops updating'
description: The todos reducer below passes its tests — the data is always right. Wire it into a component and the screen goes stale. Find what the tests could never see.
difficulty: intermediate
type: review
hints:
  - Every shipped test inspects the contents of the result. React never looks at contents — what does it compare instead?
  - Follow each case and ask whether the object coming out is the same object that went in.
  - push and direct assignment are the tell. The fix is producing new objects, not defending the old ones.
tags:
  - code-review
  - reducers
  - immutability
---

You asked a model for a todos reducer: add, toggle, clear completed. It
produced this, with tests. The tests pass, and the data is always correct.

Mounted in a component, the list stops re-rendering. React decides whether
anything changed by comparing references — `Object.is(prev, next)` — and this
reducer returns the same object it was given, freshly mutated. The contents
are right; the identity says "nothing happened". A test suite that only ever
inspects contents is structurally unable to notice, which is why all of these
pass.

Find the defect and fix it. You are graded on tests you cannot see.

```typescript
export interface Todo {
  id: number
  title: string
  done: boolean
}

export type TodosAction =
  | { type: 'add'; id: number; title: string }
  | { type: 'toggle'; id: number }
  | { type: 'clear-completed' }

export function todosReducer(state: Todo[], action: TodosAction): Todo[] {
  switch (action.type) {
    case 'add':
      state.push({ id: action.id, title: action.title, done: false })
      return state
    case 'toggle': {
      const todo = state.find((t) => t.id === action.id)
      if (todo) todo.done = !todo.done
      return state
    }
    case 'clear-completed': {
      for (let i = state.length - 1; i >= 0; i--) {
        if (state[i].done) state.splice(i, 1)
      }
      return state
    }
  }
}
```

## The tests it came with

These all pass. Every assertion is about contents; not one is about identity.

```typescript
import { describe, expect, it } from 'vitest'

describe('todosReducer', () => {
  it('adds a todo', () => {
    const next = todosReducer([], { type: 'add', id: 1, title: 'ship' })
    expect(next).toHaveLength(1)
    expect(next[0].title).toBe('ship')
  })

  it('toggles a todo', () => {
    const state = [{ id: 1, title: 'ship', done: false }]
    const next = todosReducer(state, { type: 'toggle', id: 1 })
    expect(next[0].done).toBe(true)
  })

  it('clears completed todos', () => {
    const state = [
      { id: 1, title: 'ship', done: true },
      { id: 2, title: 'rest', done: false },
    ]
    const next = todosReducer(state, { type: 'clear-completed' })
    expect(next).toHaveLength(1)
  })
})
```

## Tests

```typescript
import { describe, expect, it } from 'vitest'
import { todosReducer, type Todo } from './solution'

describe('todosReducer', () => {
  it('adds a todo', () => {
    const next = todosReducer([], { type: 'add', id: 1, title: 'ship' })
    expect(next).toHaveLength(1)
    expect(next[0].title).toBe('ship')
  })

  it('toggles a todo', () => {
    const state = [{ id: 1, title: 'ship', done: false }]
    const next = todosReducer(state, { type: 'toggle', id: 1 })
    expect(next[0].done).toBe(true)
  })

  it('clears completed todos', () => {
    const state = [
      { id: 1, title: 'ship', done: true },
      { id: 2, title: 'rest', done: false },
    ]
    const next = todosReducer(state, { type: 'clear-completed' })
    expect(next).toHaveLength(1)
  })

  it('add returns a new array, so React can see the change', () => {
    const state: Todo[] = []
    const next = todosReducer(state, { type: 'add', id: 1, title: 'ship' })
    expect(next).not.toBe(state)
    expect(state).toHaveLength(0)
  })

  it('toggle does not mutate the previous state', () => {
    const state = [{ id: 1, title: 'ship', done: false }]
    const next = todosReducer(state, { type: 'toggle', id: 1 })
    expect(next).not.toBe(state)
    expect(state[0].done).toBe(false)
  })

  it('toggle replaces the changed todo object, not just the array', () => {
    // Memoized children compare item references too: a new array holding the
    // same mutated object still skips their re-render.
    const state = [{ id: 1, title: 'ship', done: false }]
    const next = todosReducer(state, { type: 'toggle', id: 1 })
    expect(next[0]).not.toBe(state[0])
  })

  it('clear-completed does not mutate the previous state', () => {
    const state = [
      { id: 1, title: 'ship', done: true },
      { id: 2, title: 'rest', done: false },
    ]
    const next = todosReducer(state, { type: 'clear-completed' })
    expect(next).not.toBe(state)
    expect(state).toHaveLength(2)
  })

  it('untouched todos keep their identity so memoized rows stay skipped', () => {
    const state = [
      { id: 1, title: 'ship', done: false },
      { id: 2, title: 'rest', done: false },
    ]
    const next = todosReducer(state, { type: 'toggle', id: 1 })
    expect(next[1]).toBe(state[1])
  })
})
```

## Solution

```typescript
export interface Todo {
  id: number
  title: string
  done: boolean
}

export type TodosAction =
  | { type: 'add'; id: number; title: string }
  | { type: 'toggle'; id: number }
  | { type: 'clear-completed' }

/*
 * The original mutated `state` (push, property assignment, splice) and
 * returned it. Contents right, identity unchanged — and identity is the only
 * thing React looks at: Object.is(prev, next) says "no change", so no
 * re-render. The fix is not defensive copying of inputs; it is returning new
 * objects along the changed path, and ONLY the changed path — untouched
 * todos keep their identity so memoized rows can keep skipping work.
 */
export function todosReducer(state: Todo[], action: TodosAction): Todo[] {
  switch (action.type) {
    case 'add':
      return [...state, { id: action.id, title: action.title, done: false }]
    case 'toggle':
      return state.map((todo) =>
        todo.id === action.id ? { ...todo, done: !todo.done } : todo
      )
    case 'clear-completed':
      return state.filter((todo) => !todo.done)
  }
}
```
