---
title: The error that is not the error
description: A production bug where every server-rendered page died with the wrong exception, two confident diagnoses that were both wrong, and the mistake in the reproduction that let them survive.
date: '2026-08-06'
author: BlankCode
tags:
  - debugging
  - nuxt
  - postmortem
---

Every server-rendered page on this site returned 500. The message was specific
and completely misleading:

```
TypeError: Cannot read properties of undefined (reading 'state')
    at app:rendered
```

`app:rendered` is a Nuxt hook, and the one registering it here belongs to Pinia:

```js
'app:rendered'() {
  const nuxtApp = useNuxtApp()
  nuxtApp.payload.pinia = toRaw(nuxtApp.$pinia).state.value
}
```

So `$pinia` was undefined. Pinia's own plugin provides it. The plugin had
evidently not run — but its hook had. That combination is worth understanding,
because it is a general trap, not a Pinia one.

## Why the wrong error wins

Nuxt applies plugins like this:

```js
async function applyPlugins(nuxtApp, plugins) {
  for (const plugin of plugins) registerPluginHooks(nuxtApp, plugin)
  for (const plugin of plugins) {
    try { await applyPlugin(nuxtApp, plugin) } catch (e) { /* ... */ }
  }
}
```

Two passes. **Every** plugin's hooks are registered before **any** plugin's
setup runs. So when a setup throws, that plugin's hooks are already armed. Nuxt
renders its error page, `app:rendered` fires, the hook reaches for the thing
setup never provided, and *that* exception is the one that reaches the response.

The first error is gone. What you get is the second error, thrown by code that
is working exactly as designed, in a library that has nothing to do with the
problem.

Any framework with a register-then-run lifecycle can do this to you. It is worth
recognising the shape: an error inside a well-known library's own internals,
where the library is not doing anything you asked it to.

## Two confident wrong answers

**"Duplicate Vue copies."** The traced bundle really did contain
`@vue/runtime-core@3.5.41` and `@3.5.27`. Two copies of a singleton library
genuinely cause this class of bug — this same project had been bitten by two
copies of `@codemirror/state` not long before. The evidence fit, the precedent
fit, the fix was obvious. A clean install removed the duplicates. The failure
stayed.

**"Concurrency."** The platform reuses instances across concurrent requests, and
the framework resolves its app context through a module-level variable unless
you opt into async storage. Two overlapping renders clobbering each other would
produce exactly this. Thirty simultaneous requests all returned 200.

Both were good hypotheses. Both were wrong. Notice what they have in common:
each explained the *symptom* — a context missing something it should have — and
neither was ever tested against the actual first error, because the actual first
error was invisible.

## The mistake that kept them alive

The reason those wrong answers survived so long is not that they were clever. It
is that the reproduction was broken and nobody knew it.

The built server was being run locally, killed between experiments, and
restarted on the same port. The kill did not always match the process. So some
runs were answered by an older server still listening — including the runs that
"proved" a fix worked and the runs that "proved" the bug did not reproduce
locally.

For a good while the load-bearing belief was: *it works locally, so it must be
the platform.* That was never true. The bug reproduced locally on the first
attempt once each experiment got its own fresh port.

Ten minutes after that, the answer was in hand.

## The actual bug

Patch the plugin loop to log what it swallows, and it says:

```
[DIAG] applying plugin: pinia
[DIAG] PLUGIN THREW: pinia -> ReferenceError: __VUE_PROD_DEVTOOLS__ is not defined
```

`__VUE_PROD_DEVTOOLS__` is one of Vue's compile-time feature flags. A bundler is
supposed to substitute it. That happens for everything the build compiles — but
the server build *externalises* Pinia into `node_modules` rather than bundling
it, so Pinia's copy still contains the bare identifier, and the first
`createPinia()` on the server dies.

Build-time replacement cannot fix a file that was never part of the build. A
global can, since a bare identifier resolves through `globalThis`.

## The fix that also did nothing

First attempt:

```js
globalThis.__VUE_PROD_DEVTOOLS__ ??= false
```

Correct in the source. In the build output:

```js
globalThis.false ??= false
```

The replacement is plain text and does not stop at identifiers, so it rewrote
the property name too. A silent no-op that reads perfectly. The working version
assembles the names from pieces so nothing can match them, and a test now fails
if anyone writes a whole token in that file — because nothing else would catch
it.

## What generalises

**An error inside a library's internals is often not about that library.** Ask
what ran before it, especially in anything with a register-then-run lifecycle.

**A hypothesis that explains the symptom is not evidence.** All three
explanations here explained the symptom perfectly. Only one was true.

**Distrust "it works locally" hardest when it is load-bearing.** The moment that
claim becomes the reason a whole class of cause is excluded, go verify the
reproduction itself. A stale process on a reused port is enough to invent an
entire false theory of a bug, and it will not announce itself.

**Instrument earlier than feels necessary.** Every minute spent theorising after
the second failed hypothesis was worse than the five minutes it took to print
what the framework was throwing away.
