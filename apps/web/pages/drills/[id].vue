<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from '~/components/ui/button.vue'
import { AUTH_COOKIE_OPTIONS } from '~/utils/auth-cookie'

/**
 * One generated drill: code with the load-bearing tokens taken out.
 *
 * The interaction is the tutorial checkpoint's (`components/content/CodeBlank.vue`)
 * — inline inputs sized to the gap, a Check button, per-blank colour — because
 * that is what filling in a blank looks like on this site and a second idiom
 * for the same act would be a worse one. What is different is where the truth
 * lives: the checkpoint holds its answers in the markdown and grades in the
 * browser, and this page has neither. The starter and the placeholders are all
 * it is given; the verdicts come back from the server, which is the only place
 * the answers exist.
 */

definePageMeta({ requiresAuth: true, middleware: 'auth' })

interface Blank {
  id: string
  from: number
  to: number
  placeholder: string
}

interface Drill {
  id: string
  title: string
  description: string
  conceptSlug: string
  trackSlug: string
  language: string
  starterCode: string
  blanks: Blank[]
  source: { failedShare: number; attempts: number; window: string }
  attempts: number
  solvedAt: string | null
  createdAt: string
}

type Verdict = 'correct' | 'incorrect'

const route = useRoute()
const id = computed(() => route.params['id'] as string)

function headers(): Record<string, string> {
  const token = useCookie<string | null>('token', AUTH_COOKIE_OPTIONS).value
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const { data } = await useAsyncData(`drill-${id.value}`, () =>
  $fetch<{ drill: Drill }>(`/api/drills/${id.value}`, { headers: headers() }).catch(() => null)
)

if (!data.value) {
  throw createError({ statusCode: 404, statusMessage: 'Drill not found', fatal: true })
}

const drill = computed(() => data.value?.drill)

/**
 * The starter split into fixed text and gaps, by character offset.
 *
 * The offsets were computed by `generateStarterCode` against this exact string
 * and stored beside it, so the slices line up by construction rather than by a
 * second parse that could disagree with the first.
 */
interface Segment {
  kind: 'text' | 'blank'
  text: string
  id?: string
  placeholder?: string
}

const segments = computed<Segment[]>(() => {
  const current = drill.value
  if (!current) return []

  const ordered = current.blanks.toSorted((a, b) => a.from - b.from)
  const out: Segment[] = []
  let cursor = 0

  for (const blank of ordered) {
    if (blank.from > cursor) {
      out.push({ kind: 'text', text: current.starterCode.slice(cursor, blank.from) })
    }
    out.push({ kind: 'blank', text: '', id: blank.id, placeholder: blank.placeholder })
    cursor = blank.to
  }
  out.push({ kind: 'text', text: current.starterCode.slice(cursor) })

  return out
})

const answers = ref<Record<string, string>>({})
const verdicts = ref<Record<string, Verdict | null>>({})
const solvedAt = ref<string | null>(drill.value?.solvedAt ?? null)
const attempts = ref<number>(drill.value?.attempts ?? 0)
const checking = ref(false)
const error = ref('')

const attempted = computed(() => Object.values(verdicts.value).some((v) => v !== null))
const solved = computed(() => solvedAt.value !== null)

/** Sized to the gap, so the shape of the code survives being filled in. */
function widthFor(placeholder: string): string {
  return `${Math.max(3, Math.min(24, placeholder.length + 1))}ch`
}

function onInput(blankId: string, event: Event): void {
  answers.value[blankId] = (event.target as HTMLInputElement).value
  // A new keystroke invalidates the old verdict on that blank only.
  if (verdicts.value[blankId]) verdicts.value[blankId] = null
}

/**
 * What the server said, not what ofetch made of it. A FetchError's `message` is
 * the method, the URL and the status glued together; the sentence written for
 * the reader is in the body.
 */
function failureMessage(caught: unknown, fallback: string): string {
  const failure = caught as {
    data?: { statusMessage?: string; message?: string }
    statusMessage?: string
  }
  return failure.data?.statusMessage ?? failure.data?.message ?? failure.statusMessage ?? fallback
}

async function check(): Promise<void> {
  if (checking.value || !drill.value) return
  checking.value = true
  error.value = ''

  try {
    const result = await $fetch<{
      verdicts: Record<string, Verdict>
      solved: boolean
      attempts: number
      solvedAt: string | null
    }>(`/api/drills/${drill.value.id}/attempt`, {
      method: 'POST',
      headers: headers(),
      body: { answers: answers.value },
    })
    verdicts.value = { ...result.verdicts }
    attempts.value = result.attempts
    solvedAt.value = result.solvedAt
  } catch (caught) {
    error.value = failureMessage(caught, 'The check did not come back — try again.')
  } finally {
    checking.value = false
  }
}

const generating = ref(false)

/** Another drill for the same weakness, built and run the same way. */
async function generateAnother(): Promise<void> {
  if (generating.value || !drill.value) return
  generating.value = true
  error.value = ''

  try {
    const result = await $fetch<{ drill: { id: string } }>('/api/drills/generate', {
      method: 'POST',
      headers: headers(),
      body: { conceptSlug: drill.value.conceptSlug },
    })
    await navigateTo(`/drills/${result.drill.id}`)
  } catch (caught) {
    error.value = failureMessage(caught, 'The drill was not generated. Nothing was saved.')
  } finally {
    generating.value = false
  }
}

const conceptName = computed(() => (drill.value?.conceptSlug ?? '').replaceAll('-', ' '))

/** Why this drill exists, in the numbers it was built from. */
const provenance = computed(() => {
  const current = drill.value
  if (!current) return ''
  if (current.source.attempts === 0) {
    return `Generated from your last 30 days on ${conceptName.value} — no attempts on record in that window.`
  }
  return `Generated from your last 30 days on ${conceptName.value} — ${Math.round(current.source.failedShare * 100)}% failed.`
})

function solvedDate(iso: string): string {
  return iso.slice(0, 10)
}

useSeoMeta({
  title: () => `${drill.value?.title ?? 'Drill'} — BlankCode`,
  description: () => drill.value?.description ?? '',
})
</script>

<template>
  <div v-if="drill" class="container max-w-3xl py-8 md:py-12">
    <p class="eyebrow mb-2">drill</p>
    <h1 class="display text-xl md:text-2xl mb-2">{{ drill.title }}</h1>
    <p class="mb-4 font-mono text-xs text-muted-foreground">
      {{ conceptName }} · {{ drill.trackSlug }} · generated, then run against its own tests
    </p>

    <p class="mb-1 max-w-xl leading-relaxed">{{ drill.description }}</p>
    <p class="mb-6 max-w-xl font-mono text-xs text-muted-foreground">{{ provenance }}</p>

    <div class="overflow-hidden rounded border border-rule">
      <div class="flex items-baseline justify-between border-b border-rule bg-muted/40 px-4 py-2">
        <p class="eyebrow">fill it in</p>
        <p class="font-mono text-xs text-muted-foreground">
          {{ drill.blanks.length }} {{ drill.blanks.length === 1 ? 'blank' : 'blanks' }} ·
          {{ drill.language }}
        </p>
      </div>

      <pre
        class="overflow-x-auto bg-code-bg px-4 py-3 font-mono text-sm leading-relaxed"
      ><code><template v-for="(segment, s) in segments" :key="s"><span v-if="segment.kind === 'text'">{{ segment.text }}</span><input
        v-else
        :value="answers[segment.id!] ?? ''"
        :style="{ width: widthFor(segment.placeholder!) }"
        class="drill-blank-input"
        :class="{
          'drill-blank-correct': verdicts[segment.id!] === 'correct',
          'drill-blank-incorrect': verdicts[segment.id!] === 'incorrect',
        }"
        type="text"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
        :aria-label="`Blank ${s}`"
        @input="onInput(segment.id!, $event)"
        @keydown.enter="check"
      /></template></code></pre>

      <div
        class="flex flex-wrap items-center justify-between gap-3 border-t border-rule px-4 py-2.5"
      >
        <Button size="sm" :disabled="checking" @click="check">
          {{ checking ? 'Checking…' : 'Check' }}
        </Button>
        <p v-if="solved" class="font-mono text-xs text-pass">that's it</p>
        <p v-else-if="attempted" class="font-mono text-xs text-fail">
          not yet — the marked gaps are the wrong ones
        </p>
        <p v-else class="font-mono text-xs text-muted-foreground">type into the gaps, then check</p>
      </div>
    </div>

    <p v-if="error" class="mt-3 text-sm text-fail">{{ error }}</p>

    <!-- Solved: say when, and offer the next one for the same weakness. -->
    <section v-if="solved" class="mt-8">
      <p class="mb-3 leading-relaxed">
        Solved on {{ solvedDate(solvedAt!) }}, after {{ attempts }}
        {{ attempts === 1 ? 'attempt' : 'attempts' }}.
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="outline" :disabled="generating" @click="generateAnother">
          {{ generating ? 'Building…' : 'generate another for this concept' }}
        </Button>
        <NuxtLink
          to="/drills"
          class="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          back to your drills &#8594;
        </NuxtLink>
      </div>
      <p v-if="generating" class="mt-3 font-mono text-xs text-muted-foreground">
        building and running your drill — it must pass its own tests before you see it
      </p>
    </section>

    <p v-else-if="attempts > 0" class="mt-4 font-mono text-xs text-muted-foreground">
      {{ attempts }} {{ attempts === 1 ? 'attempt' : 'attempts' }} so far
    </p>
  </div>
</template>

<style scoped>
.drill-blank-input {
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

.drill-blank-input:hover {
  background: hsl(var(--signal) / 0.14);
}

.drill-blank-input:focus {
  outline: none;
  background: hsl(var(--signal) / 0.16);
  border-bottom-color: hsl(var(--signal));
}

.drill-blank-correct {
  color: hsl(var(--pass));
  border-bottom-color: hsl(var(--pass));
  background: hsl(var(--pass) / 0.08);
}

.drill-blank-incorrect {
  color: hsl(var(--fail));
  border-bottom-color: hsl(var(--fail));
  background: hsl(var(--fail) / 0.08);
}
</style>
