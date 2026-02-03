---
slug: vue-pinia-001
title: Define a Pinia Store
description: Create a Pinia store using the Composition API setup syntax.
difficulty: intermediate
hints:
  - defineStore takes a unique name and setup function
  - Use ref() for state and computed() for getters
  - Return everything that should be accessible
tags:
  - vue
  - pinia
  - state-management
---

Create a todo list store with Pinia.

```typescript
import { ___blank_start___defineStore___blank_end___ } from 'pinia'
import { ref, computed } from 'vue'

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

export const useTodoStore = defineStore('todos', () => {
  const todos = ___blank_start___ref<Todo[]>([])___blank_end___
  let nextId = 1

  const completedTodos = computed(() => {
    return todos.value.___blank_start___filter((todo) => todo.completed)___blank_end___
  })

  const pendingTodos = computed(() => {
    return todos.value.filter((todo) => !todo.completed)
  })

  const totalCount = computed(() => todos.value.length)

  function addTodo(text: string) {
    todos.value.push({
      id: nextId++,
      text,
      ___blank_start___completed: false___blank_end___,
    })
  }

  function toggleTodo(id: number) {
    const todo = todos.value.find((t) => t.id === id)
    if (todo) {
      ___blank_start___todo.completed = !todo.completed___blank_end___
    }
  }

  function removeTodo(id: number) {
    const index = todos.value.findIndex((t) => t.id === id)
    if (index > -1) {
      todos.value.splice(index, 1)
    }
  }

  return {
    todos,
    completedTodos,
    pendingTodos,
    totalCount,
    addTodo,
    toggleTodo,
    removeTodo,
  }
})
```

## Tests

```typescript
import { expect, test, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTodoStore } from './todo-store'

beforeEach(() => {
  setActivePinia(createPinia())
})

test('starts with empty todos', () => {
  const store = useTodoStore()
  expect(store.todos).toEqual([])
  expect(store.totalCount).toBe(0)
})

test('adds a todo', () => {
  const store = useTodoStore()
  store.addTodo('Learn Pinia')
  expect(store.todos).toHaveLength(1)
  expect(store.todos[0].text).toBe('Learn Pinia')
  expect(store.todos[0].completed).toBe(false)
})

test('toggles todo completion', () => {
  const store = useTodoStore()
  store.addTodo('Test')
  const id = store.todos[0].id
  store.toggleTodo(id)
  expect(store.todos[0].completed).toBe(true)
  store.toggleTodo(id)
  expect(store.todos[0].completed).toBe(false)
})

test('filters completed and pending', () => {
  const store = useTodoStore()
  store.addTodo('Task 1')
  store.addTodo('Task 2')
  store.toggleTodo(store.todos[0].id)

  expect(store.completedTodos).toHaveLength(1)
  expect(store.pendingTodos).toHaveLength(1)
})

test('removes a todo', () => {
  const store = useTodoStore()
  store.addTodo('To remove')
  const id = store.todos[0].id
  store.removeTodo(id)
  expect(store.todos).toHaveLength(0)
})
```
