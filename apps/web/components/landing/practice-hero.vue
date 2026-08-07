<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import Button from '~/components/ui/button.vue'

/**
 * The hero is a real exercise, not a mockup of one.
 *
 * The whole product is a single gesture — read almost-complete code, supply the
 * missing piece, run the tests — so the landing page performs that gesture
 * instead of describing it. No account, no API call, no navigation: the visitor
 * does one rep before deciding anything.
 */

interface Blank {
  id: string
  /** Everything accepted as correct, compared after trimming. */
  answers: string[]
  width: number
}

const BLANKS: Blank[] = [
  { id: 'a', answers: ['1'], width: 3 },
  { id: 'b', answers: ['2'], width: 3 },
]

const values = ref<Record<string, string>>({ a: '', b: '' })
const state = ref<'idle' | 'running' | 'passed' | 'failed'>('idle')
const inputs = useTemplateRef<HTMLInputElement[]>('blankInput')

const filled = computed(() => BLANKS.filter((b) => values.value[b.id]?.trim()).length)
const canRun = computed(() => filled.value === BLANKS.length && state.value !== 'running')

function verdictFor(blank: Blank): 'correct' | 'incorrect' | null {
  if (state.value !== 'passed' && state.value !== 'failed') return null
  const value = values.value[blank.id]?.trim() ?? ''
  return blank.answers.includes(value) ? 'correct' : 'incorrect'
}

async function run() {
  if (!canRun.value) return
  state.value = 'running'
  // A beat of latency so the result reads as a consequence of running, not of typing.
  await new Promise((resolve) => setTimeout(resolve, 420))
  const allCorrect = BLANKS.every((b) => b.answers.includes(values.value[b.id]?.trim() ?? ''))
  state.value = allCorrect ? 'passed' : 'failed'
}

function reset() {
  values.value = { a: '', b: '' }
  state.value = 'idle'
  nextTick(() => inputs.value?.[0]?.focus())
}

function onInput(id: string, event: Event) {
  values.value[id] = (event.target as HTMLInputElement).value
  if (state.value === 'passed' || state.value === 'failed') state.value = 'idle'
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault()
    run()
  }
}

const resultLine = computed(() => {
  switch (state.value) {
    case 'running':
      return 'running fib.test.ts…'
    case 'passed':
      return '3 passed  ·  fib(10) === 55'
    case 'failed':
      return '1 failed  ·  expected 55, received NaN'
    default:
      return null
  }
})
</script>

<template>
  <section class="relative border-b border-rule">
    <div class="sheet sheet-fade absolute inset-0 pointer-events-none" aria-hidden="true" />

    <div class="container relative py-16 md:py-24">
      <div
        class="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16 lg:items-center"
      >
        <!-- Left: the thesis, stated plainly and left-aligned. -->
        <div>
          <p class="eyebrow mb-5">practice that sticks</p>

          <h1 class="display text-4xl md:text-5xl lg:text-[3.5rem] mb-6">
            Keep your hands from
            <span class="text-signal">forgetting</span>.
          </h1>

          <p class="text-lg text-muted-foreground leading-relaxed max-w-md mb-8">
            Read code that is almost finished. Supply the missing pieces. Real tests run in a
            sandbox and tell you immediately whether you were right.
          </p>

          <p class="text-base text-muted-foreground leading-relaxed max-w-md mb-8">
            Then it schedules the ones you are starting to lose, and brings them back before you do.
          </p>

          <div class="flex flex-wrap items-center gap-3">
            <NuxtLink to="/tracks">
              <Button size="lg">Browse tracks</Button>
            </NuxtLink>
            <NuxtLink to="/review">
              <Button variant="outline" size="lg">What's due today</Button>
            </NuxtLink>
          </div>
        </div>

        <!-- Right: the signature. A working exercise, in the page. -->
        <div>
          <div
            class="rounded border border-rule-strong bg-card shadow-sm overflow-hidden"
            @keydown="onKeydown"
          >
            <div
              class="flex items-center justify-between border-b border-rule px-4 py-2.5 bg-muted/40"
            >
              <span class="font-mono text-xs text-muted-foreground">fib.ts</span>
              <span class="eyebrow">typescript</span>
            </div>

            <div class="px-4 py-5 md:px-6 md:py-6 overflow-x-auto">
              <pre
                class="font-mono text-sm md:text-[0.9375rem] leading-[2.1]"
              ><code><span class="text-muted-foreground">function</span> <span class="font-medium">fib</span>(n: <span class="text-muted-foreground">number</span>): <span class="text-muted-foreground">number</span> {
  <span class="text-muted-foreground">if</span> (n &lt;= 1) <span class="text-muted-foreground">return</span> n
  <span class="text-muted-foreground">return</span> fib(n - <label class="sr-only" for="hero-blank-a">First blank</label><input
                id="hero-blank-a"
                ref="blankInput"
                :value="values['a']"
                :data-verdict="verdictFor(BLANKS[0]!)"
                class="hero-blank"
                :style="{ width: `${BLANKS[0]!.width}ch` }"
                inputmode="numeric"
                autocomplete="off"
                spellcheck="false"
                aria-label="First blank"
                @input="onInput('a', $event)"
              />) + fib(n - <label class="sr-only" for="hero-blank-b">Second blank</label><input
                id="hero-blank-b"
                ref="blankInput"
                :value="values['b']"
                :data-verdict="verdictFor(BLANKS[1]!)"
                class="hero-blank"
                :style="{ width: `${BLANKS[1]!.width}ch` }"
                inputmode="numeric"
                autocomplete="off"
                spellcheck="false"
                aria-label="Second blank"
                @input="onInput('b', $event)"
              />)
}</code></pre>
            </div>

            <div
              class="flex flex-wrap items-center justify-between gap-3 border-t border-rule px-4 py-3 bg-muted/40"
            >
              <p class="font-mono text-xs text-muted-foreground">
                {{ filled }} of {{ BLANKS.length }} filled
              </p>

              <div class="flex items-center gap-2">
                <Button
                  v-if="state === 'passed' || state === 'failed'"
                  variant="ghost"
                  size="sm"
                  @click="reset"
                >
                  Reset
                </Button>
                <Button size="sm" :disabled="!canRun" :loading="state === 'running'" @click="run">
                  Run tests
                </Button>
              </div>
            </div>

            <!-- One live region: the test output, exactly as the app reports it. -->
            <div
              v-if="resultLine"
              class="border-t px-4 py-3 font-mono text-xs"
              :class="{
                'border-rule text-muted-foreground': state === 'running',
                'border-pass/40 bg-pass/10 text-pass': state === 'passed',
                'border-fail/40 bg-fail/10 text-fail': state === 'failed',
              }"
              role="status"
              aria-live="polite"
            >
              {{ resultLine }}
            </div>
          </div>

          <p class="mt-3 font-mono text-xs text-muted-foreground">
            Try it — the answers are 1 and 2.
            <span class="hidden md:inline">⌘↵ runs the tests.</span>
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero-blank {
  font: inherit;
  color: hsl(var(--signal));
  background: hsl(var(--signal) / 0.08);
  border: 0;
  border-bottom: 2px solid hsl(var(--signal) / 0.5);
  border-radius: 2px 2px 0 0;
  padding: 0 0.25em;
  text-align: center;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.hero-blank:hover {
  background: hsl(var(--signal) / 0.14);
}

.hero-blank[data-verdict='correct'] {
  color: hsl(var(--pass));
  background: hsl(var(--pass) / 0.12);
  border-bottom-color: hsl(var(--pass));
}

.hero-blank[data-verdict='incorrect'] {
  color: hsl(var(--fail));
  background: hsl(var(--fail) / 0.12);
  border-bottom-color: hsl(var(--fail));
}
</style>
