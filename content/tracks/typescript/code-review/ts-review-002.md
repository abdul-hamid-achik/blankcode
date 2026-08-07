---
slug: ts-review-002
title: 'Review: the error that is not the error'
description: A plugin system reports a failure in a plugin that is working correctly. The real failure happened earlier and was thrown away. Make the original error survive.
difficulty: advanced
type: review
hints:
  - Read `applyPlugins` again. Notice that the two loops are separate, and what that means for a plugin whose setup never ran.
  - The reported error comes from a hook belonging to a plugin whose setup threw. That hook should never have been able to run.
  - Fixing the symptom (guarding the hook) hides the problem. The caller needs the first error, not a quieter second one.
tags:
  - code-review
  - debugging
  - error-handling
---

This one is real. It cost most of a day.

Every server-rendered page of a site started returning 500 with an error inside
a well-known library, in code that was working exactly as designed. Two
confident explanations were wrong before anyone realised the reported error was
not the failure at all — it was a second failure, caused by the first, thrown
from a hook belonging to the plugin that had already died.

The mini plugin system below has the same shape. `createApp` reports the wrong
error, and a caller debugging it will go and read the innocent plugin.

Make the original error survive. The reported failure must be the one that
actually happened first.

```typescript
export interface Plugin {
  name: string
  setup?: (app: App) => void
  hooks?: Record<string, (app: App) => void>
}

export interface App {
  provided: Record<string, unknown>
  hooks: Record<string, Array<(app: App) => void>>
  provide: (key: string, value: unknown) => void
  callHook: (name: string) => void
}

export function createApp(plugins: Plugin[]): App {
  const app: App = {
    provided: {},
    hooks: {},
    provide(key, value) {
      app.provided[key] = value
    },
    callHook(name) {
      for (const hook of app.hooks[name] ?? []) hook(app)
    },
  }

  applyPlugins(app, plugins)
  return app
}

function applyPlugins(app: App, plugins: Plugin[]): void {
  for (const plugin of plugins) {
    for (const [name, hook] of Object.entries(plugin.hooks ?? {})) {
      app.hooks[name] ??= []
      app.hooks[name].push(hook)
    }
  }

  for (const plugin of plugins) {
    plugin.setup?.(app)
  }
}
```

## Tests

```typescript
import { describe, expect, it } from 'vitest'
import { createApp, type Plugin } from './solution'

/** Fails during setup. Nothing it registers should ever run. */
const broken: Plugin = {
  name: 'broken',
  setup() {
    throw new Error('the real problem')
  },
  hooks: {
    rendered(app) {
      // Reaches for what its own setup never provided. This is the error that
      // was surfacing instead of the one above.
      const store = app.provided['store'] as { state: number }
      void store.state
    },
  },
}

const healthy: Plugin = {
  name: 'healthy',
  setup(app) {
    app.provide('healthy', true)
  },
}

describe('createApp', () => {
  it('reports the error that actually happened', () => {
    // Not "Cannot read properties of undefined": that one is a consequence.
    expect(() => createApp([broken])).toThrow('the real problem')
  })

  it('does not run a hook belonging to a plugin whose setup threw', () => {
    const calls: string[] = []
    const plugin: Plugin = {
      name: 'p',
      setup() {
        throw new Error('setup failed')
      },
      hooks: {
        rendered() {
          calls.push('should not happen')
        },
      },
    }

    expect(() => createApp([plugin])).toThrow('setup failed')
    expect(calls).toEqual([])
  })

  it('still runs hooks for plugins that set up cleanly', () => {
    const calls: string[] = []
    const app = createApp([
      healthy,
      {
        name: 'listener',
        setup() {},
        hooks: {
          rendered() {
            calls.push('ran')
          },
        },
      },
    ])

    app.callHook('rendered')
    expect(calls).toEqual(['ran'])
  })

  it('applies plugins in order', () => {
    const order: string[] = []
    createApp([
      { name: 'a', setup: () => void order.push('a') },
      { name: 'b', setup: () => void order.push('b') },
    ])

    expect(order).toEqual(['a', 'b'])
  })

  it('a plugin can use what an earlier one provided', () => {
    const app = createApp([
      healthy,
      {
        name: 'dependent',
        setup(a) {
          a.provide('sawHealthy', a.provided['healthy'] === true)
        },
      },
    ])

    expect(app.provided['sawHealthy']).toBe(true)
  })

  it('a failing plugin does not silently take out the ones before it', () => {
    // The earlier plugin's work is still visible on the error, so a caller can
    // see how far initialisation got.
    let captured: unknown
    try {
      createApp([healthy, broken])
    } catch (error) {
      captured = error
    }

    expect((captured as Error).message).toContain('the real problem')
  })

  it('names the plugin that failed', () => {
    // "the real problem" says nothing about where. With a dozen plugins that
    // is the difference between a minute and an afternoon.
    let message = ''
    try {
      createApp([broken])
    } catch (error) {
      message = (error as Error).message
    }

    expect(message).toContain('broken')
  })

  it('works with no plugins at all', () => {
    expect(() => createApp([])).not.toThrow()
  })

  it('leaves a hook-only plugin working', () => {
    const calls: string[] = []
    const app = createApp([{ name: 'hooky', hooks: { rendered: () => void calls.push('x') } }])

    app.callHook('rendered')
    expect(calls).toEqual(['x'])
  })
})
```

## Solution

```typescript
export interface Plugin {
  name: string
  setup?: (app: App) => void
  hooks?: Record<string, (app: App) => void>
}

export interface App {
  provided: Record<string, unknown>
  hooks: Record<string, Array<(app: App) => void>>
  provide: (key: string, value: unknown) => void
  callHook: (name: string) => void
}

export function createApp(plugins: Plugin[]): App {
  const app: App = {
    provided: {},
    hooks: {},
    provide(key, value) {
      app.provided[key] = value
    },
    callHook(name) {
      for (const hook of app.hooks[name] ?? []) hook(app)
    },
  }

  applyPlugins(app, plugins)
  return app
}

function applyPlugins(app: App, plugins: Plugin[]): void {
  /*
   * The original registered every plugin's hooks in one pass and *then* ran the
   * setups. A plugin whose setup threw therefore left its hooks armed, and the
   * first one to fire reached for state that setup had never provided. That
   * second failure is what reached the caller, from a plugin that was working
   * exactly as designed — so debugging it meant reading innocent code.
   *
   * Setting up first and registering after ties a plugin's hooks to its own
   * success. A plugin that did not start cannot be called.
   */
  for (const plugin of plugins) {
    try {
      plugin.setup?.(app)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      // Named, because "the real problem" with a dozen plugins registered is
      // the difference between a minute and an afternoon.
      throw new Error(`plugin "${plugin.name}" failed to set up: ${message}`, { cause })
    }

    for (const [name, hook] of Object.entries(plugin.hooks ?? {})) {
      app.hooks[name] ??= []
      app.hooks[name].push(hook)
    }
  }
}
```
