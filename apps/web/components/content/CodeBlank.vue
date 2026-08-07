<script setup lang="ts">
/**
 * An interactive checkpoint inside a tutorial: real code with a few pieces
 * blanked out, graded instantly in the client. This is the product's whole
 * thesis embedded in its own reading — you do not finish a section by
 * nodding, you finish it by producing the missing piece from what you just
 * read.
 *
 * Used from markdown as an MDC block:
 *
 *   ::code-blank{lang="typescript" href="/tracks/typescript/generics"}
 *   ---
 *   code: |
 *     function identity<___blank_start___T___blank_end___>(value: T): T {
 *       return value
 *     }
 *   ---
 *   ::
 *
 * Same markers as the exercise format, same grading rule (exact compare,
 * whitespace-trimmed), deliberately: this IS a miniature of the real thing,
 * and the closing line says where the graded version lives.
 */

const props = defineProps<{
  code: string
  lang?: string
  /** Where the graded version of this idea lives. */
  href?: string
  /** Label for the link; defaults to "practice it for real". */
  label?: string
}>()

const START = '___blank_start___'
const END = '___blank_end___'

interface Segment {
  kind: 'text' | 'blank'
  text: string
  index?: number
}

/** The code split into fixed text and blanks, in order. */
const segments = computed<Segment[]>(() => {
  const out: Segment[] = []
  let rest = props.code.replace(/\n$/, '')
  let blankIndex = 0
  while (rest.length > 0) {
    const start = rest.indexOf(START)
    if (start === -1) {
      out.push({ kind: 'text', text: rest })
      break
    }
    if (start > 0) out.push({ kind: 'text', text: rest.slice(0, start) })
    const afterStart = rest.slice(start + START.length)
    const end = afterStart.indexOf(END)
    if (end === -1) {
      out.push({ kind: 'text', text: afterStart })
      break
    }
    out.push({ kind: 'blank', text: afterStart.slice(0, end).trim(), index: blankIndex })
    blankIndex += 1
    rest = afterStart.slice(end + END.length)
  }
  return out
})

const blanks = computed(() => segments.value.filter((s) => s.kind === 'blank'))

const answers = ref<string[]>([])
const verdicts = ref<Array<'correct' | 'incorrect' | null>>([])
const solved = ref(false)

watch(
  blanks,
  (list) => {
    answers.value = list.map(() => '')
    verdicts.value = list.map(() => null)
    solved.value = false
  },
  { immediate: true }
)

function widthFor(solution: string): string {
  return `${Math.max(3, Math.min(24, solution.length + 1))}ch`
}

function check() {
  verdicts.value = blanks.value.map((blank, i) =>
    (answers.value[i] ?? '').trim() === blank.text ? 'correct' : 'incorrect'
  )
  solved.value = verdicts.value.every((v) => v === 'correct')
}

function onInput(i: number, event: Event) {
  answers.value[i] = (event.target as HTMLInputElement).value
  // A new keystroke invalidates the old verdict on that blank only.
  if (verdicts.value[i]) verdicts.value[i] = null
  if (solved.value) solved.value = false
}

const attempted = computed(() => verdicts.value.some((v) => v !== null))
</script>

<template>
  <div class="code-blank not-article my-8 overflow-hidden rounded border border-rule">
    <div class="flex items-baseline justify-between border-b border-rule bg-muted/40 px-4 py-2">
      <p class="eyebrow">fill it in</p>
      <p class="font-mono text-xs text-muted-foreground">
        {{ blanks.length }} {{ blanks.length === 1 ? 'blank' : 'blanks' }} · graded here, free
      </p>
    </div>

    <pre
      class="overflow-x-auto bg-code-bg px-4 py-3 font-mono text-sm leading-relaxed"
    ><code><template v-for="(segment, s) in segments" :key="s"><span v-if="segment.kind === 'text'">{{ segment.text }}</span><input
        v-else
        :value="answers[segment.index!]"
        :style="{ width: widthFor(segment.text) }"
        class="code-blank-input"
        :class="{
          'code-blank-correct': verdicts[segment.index!] === 'correct',
          'code-blank-incorrect': verdicts[segment.index!] === 'incorrect',
        }"
        type="text"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
        :aria-label="`Blank ${segment.index! + 1}`"
        @input="onInput(segment.index!, $event)"
        @keydown.enter="check"
      /></template></code></pre>

    <div class="flex flex-wrap items-center justify-between gap-3 border-t border-rule px-4 py-2.5">
      <button
        class="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
        type="button"
        @click="check"
      >
        Check
      </button>
      <p v-if="solved" class="font-mono text-xs text-pass">
        that's the shape<template v-if="href">
          —
          <NuxtLink
            :to="href"
            class="underline decoration-rule-strong underline-offset-2 transition-colors hover:text-foreground"
            >{{ label ?? 'practice it for real' }}</NuxtLink
          ></template
        >
      </p>
      <p v-else-if="attempted" class="font-mono text-xs text-fail">
        not yet — reread the section above
      </p>
      <p v-else class="font-mono text-xs text-muted-foreground">type into the gaps, then check</p>
    </div>
  </div>
</template>

<style scoped>
.code-blank-input {
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

.code-blank-input:hover {
  background: hsl(var(--signal) / 0.14);
}

.code-blank-input:focus {
  outline: none;
  background: hsl(var(--signal) / 0.16);
  border-bottom-color: hsl(var(--signal));
}

.code-blank-correct {
  color: hsl(var(--pass));
  border-bottom-color: hsl(var(--pass));
  background: hsl(var(--pass) / 0.08);
}

.code-blank-incorrect {
  color: hsl(var(--fail));
  border-bottom-color: hsl(var(--fail));
  background: hsl(var(--fail) / 0.08);
}
</style>
