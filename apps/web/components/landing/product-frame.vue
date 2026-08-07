<script setup lang="ts">
/**
 * The product at full size, drawn in HTML so it server-renders in both themes.
 *
 * The hero above is a four-line rep; this is the screen around a real one: the
 * editor with its blanks filled, the runner's verdict, and the date the
 * exercise comes back. Everything in the frame is taken from the product —
 * the code and test names are `ts-async-001` from the TypeScript track, and
 * the return intervals are the scheduler's.
 */
const TESTS = ['resolves with greeting after delay', 'works with different names']

const NOTES = [
  {
    key: 'tests',
    title: 'The grade is the suite',
    body: "Every exercise ships with its own tests. What you see after a run is the runner's output — pass, fail, and why.",
  },
  {
    key: 'sandbox',
    title: 'Runs are isolated',
    body: 'Each submission gets its own sandboxed microVM, created for that run, destroyed after it, and cut off at a hard time limit.',
  },
  {
    key: 'schedule',
    title: 'Passing sets a return date',
    body: 'A pass moves the exercise out — a day, then three, then longer as it holds. A fail brings it back tomorrow.',
  },
]
</script>

<template>
  <section class="border-b border-rule">
    <div class="container py-16 md:py-20">
      <p class="eyebrow mb-3">the editor</p>
      <h2 class="display text-2xl md:text-3xl mb-3 max-w-lg">What a session looks like.</h2>
      <p class="text-muted-foreground max-w-lg mb-10">
        An exercise from the TypeScript track, one run in. The blanks are the only thing you type;
        the tests decide.
      </p>

      <div class="grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-14">
        <!-- The frame: editor, verdict, schedule. Static, true to the product. -->
        <figure class="rounded border border-rule-strong bg-card shadow-sm overflow-hidden">
          <div
            class="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-4 py-2.5 bg-muted/40"
          >
            <span class="font-mono text-xs text-muted-foreground">
              typescript / async-patterns / basic-promise-creation
            </span>
            <span class="eyebrow">3 of 3 filled</span>
          </div>

          <div class="px-4 py-5 md:px-6 overflow-x-auto">
            <pre
              class="font-mono text-[0.8125rem] md:text-sm leading-[2]"
            ><code><span class="text-muted-foreground">function</span> <span class="font-medium">delayedGreeting</span>(name: <span class="text-muted-foreground">string</span>, delayMs: <span class="text-muted-foreground">number</span>): <span class="text-muted-foreground">Promise&lt;string&gt;</span> {
  <span class="text-muted-foreground">return</span> <span class="text-muted-foreground">new</span> <span class="frame-blank">Promise</span>((resolve) =&gt; {
    <span class="frame-blank">setTimeout</span>(() =&gt; {
      resolve(`Hello, ${<span class="frame-blank">name</span>}!`)
    }, delayMs)
  })
}</code></pre>
          </div>

          <div class="border-t border-rule">
            <div class="px-4 py-2 md:px-6 bg-muted/40 border-b border-rule">
              <span class="eyebrow">test output</span>
            </div>
            <ul class="px-4 py-3 md:px-6 font-mono text-xs space-y-1.5">
              <li v-for="test in TESTS" :key="test" class="text-muted-foreground">
                <span class="text-pass" aria-hidden="true">✓</span>
                <span class="sr-only">passed:</span>
                {{ test }}
              </li>
              <li class="pt-1 text-pass">{{ TESTS.length }} passed (2.4s)</li>
            </ul>
          </div>

          <figcaption
            class="flex flex-wrap items-center justify-between gap-2 border-t border-rule px-4 py-2.5 md:px-6 bg-muted/40 font-mono text-xs"
          >
            <span class="text-pass">Passed</span>
            <span class="text-muted-foreground">next review · 3 days</span>
          </figcaption>
        </figure>

        <!-- The margin notes: what the frame just showed, stated once each. -->
        <dl>
          <div
            v-for="note in NOTES"
            :key="note.key"
            class="border-t border-rule py-5 first:border-t-0 first:pt-0 lg:first:pt-5 lg:first:border-t"
          >
            <dt class="flex items-baseline gap-3 mb-2">
              <span class="eyebrow text-signal">{{ note.key }}</span>
              <span class="display text-base">{{ note.title }}</span>
            </dt>
            <dd class="text-sm text-muted-foreground leading-relaxed">{{ note.body }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* A blank after the mark is made and confirmed: the slot in the pass colour. */
.frame-blank {
  color: hsl(var(--pass));
  background: hsl(var(--pass) / 0.12);
  border-bottom: 2px solid hsl(var(--pass) / 0.7);
  border-radius: 2px 2px 0 0;
  padding: 0 0.25em;
}
</style>
