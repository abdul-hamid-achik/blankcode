---
slug: vue-review-003
title: 'Review: a listener that outlives its component'
description: The keyboard-shortcut composable below passes its tests. Unmount the component and the shortcut keeps firing into the void. Find what setup forgot to undo.
difficulty: advanced
type: review
hints:
  - The shipped tests mount and assert. Neither ever unmounts — and the bug is the unmount.
  - Everything registered in setup needs an owner. Who removes this listener, and when?
  - Vue gives composables a hook for exactly this moment. Its name says when it runs.
tags:
  - code-review
  - composables
  - lifecycle
---

You asked a model for a composable that runs a callback when a given key is
pressed — the standard keyboard-shortcut helper. It produced this, with
tests. The tests pass.

The listener is never removed. Every component that ever used this
composable is still wired to the document after unmount: handlers firing on
dead components, state updates against torn-down trees, and — in a
long-lived app — one more leaked closure per navigation, forever. The
shipped tests mount and press keys; not one unmounts, and unmounting is
where this composable's only obligation lives.

`addEventListener` in setup is a loan, not a gift. Find where it should have
been returned. You are graded on tests you cannot see.

```typescript
import { onMounted } from 'vue'

/**
 * Calls `handler` whenever `key` is pressed, for as long as the owning
 * component is mounted.
 */
export function useKeyPress(key: string, handler: () => void): void {
  onMounted(() => {
    document.addEventListener('keydown', (event) => {
      if (event.key === key) {
        handler()
      }
    })
  })
}
```

## The tests it came with

These all pass. Mount, press, assert — the lifetime of the listener is never
questioned.

```typescript
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

function harness(key: string, handler: () => void) {
  return defineComponent({
    setup() {
      useKeyPress(key, handler)
      return () => h('div')
    },
  })
}

describe('useKeyPress', () => {
  it('fires on the configured key', () => {
    const handler = vi.fn()
    mount(harness('Escape', handler))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('ignores other keys', () => {
    const handler = vi.fn()
    mount(harness('Escape', handler))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(handler).not.toHaveBeenCalled()
  })
})
```

## Tests

```typescript
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { useKeyPress } from './solution'

function harness(key: string, handler: () => void) {
  return defineComponent({
    setup() {
      useKeyPress(key, handler)
      return () => h('div')
    },
  })
}

describe('useKeyPress', () => {
  it('fires on the configured key', () => {
    const handler = vi.fn()
    const wrapper = mount(harness('Escape', handler))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(handler).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('ignores other keys', () => {
    const handler = vi.fn()
    const wrapper = mount(harness('Escape', handler))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(handler).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('stops firing after unmount', () => {
    // The composable's one obligation: "for as long as the owning component
    // is mounted" has an ending, and the ending is the exercise.
    const handler = vi.fn()
    const wrapper = mount(harness('Escape', handler))
    wrapper.unmount()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(handler).not.toHaveBeenCalled()
  })

  it('two mounts do not double-fire after one unmounts', () => {
    // The leak compounds: every past mount still listening means N calls
    // per keypress after N navigations. Two is enough to prove the shape.
    const first = vi.fn()
    const second = vi.fn()
    const wrapperA = mount(harness('Escape', first))
    const wrapperB = mount(harness('Escape', second))
    wrapperA.unmount()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
    wrapperB.unmount()
  })
})
```

## Solution

```typescript
import { onMounted, onUnmounted } from 'vue'

/**
 * Calls `handler` whenever `key` is pressed, for as long as the owning
 * component is mounted.
 */
export function useKeyPress(key: string, handler: () => void): void {
  // The original attached an anonymous listener and kept no reference — it
  // could not have removed it even if something had tried. Naming the
  // function is what makes removal possible; onUnmounted is what makes it
  // happen. Without the pair, every component that ever used this
  // composable stays wired to the document for the life of the page.
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === key) {
      handler()
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', onKeydown)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', onKeydown)
  })
}
```
