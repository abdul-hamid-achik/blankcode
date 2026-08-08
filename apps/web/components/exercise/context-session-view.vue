<script setup lang="ts">
import Button from '~/components/ui/button.vue'
import { useAnalytics } from '~/composables/useAnalytics'
import { AUTH_COOKIE_OPTIONS } from '~/utils/auth-cookie'

/**
 * Form E: context selection. The page is a receipt.
 *
 * A menu of sources with prices in mono, a running total, and rows that
 * expand when bought and stay held forever — the cost is of having been
 * shown a thing, and un-seeing is not for sale. The report keeps `correct`
 * and `sufficient` apart, because a right answer produced without the model
 * being given what it needed is a lucky guess wearing a win.
 */

const analytics = useAnalytics()

const props = defineProps<{
  exercise: { id: string; title: string; description: string }
}>()

interface MenuSource {
  id: string
  label: string
  tokens: number
}

interface SessionInfo {
  id: string
  status: 'open' | 'submitted' | 'abandoned'
  sources: MenuSource[]
  selected: string[]
  answer: string | null
}

const session = ref<SessionInfo | null>(null)
const phase = ref<'loading' | 'fresh' | 'live' | 'submitted'>('loading')
const contents = ref<Map<string, string>>(new Map())
const tokensSpent = ref(0)
const answer = ref('')
const busy = ref(false)
const buying = ref<string | null>(null)
const error = ref('')

interface Report {
  correct: boolean
  sufficient: boolean
  tokensSpent: number
  minimalTokens: number
  tokensWasted: number
  unnecessary: string[]
  unknown: string[]
}
const report = ref<Report | null>(null)

function authHeaders(): Record<string, string> {
  const token = useCookie<string | null>('token', AUTH_COOKIE_OPTIONS).value
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const held = computed(() => new Set(session.value?.selected ?? []))

const runningTotal = computed(() => {
  if (!session.value) return 0
  return session.value.sources
    .filter((source) => held.value.has(source.id))
    .reduce((sum, source) => sum + source.tokens, 0)
})

function labelOf(id: string): string {
  return session.value?.sources.find((source) => source.id === id)?.label ?? id
}

// Resume: reload the receipt and re-request held contents (free — the charge
// is of having been shown it, and these were).
onMounted(async () => {
  try {
    const { sessionId } = await $fetch<{ sessionId: string | null }>('/api/context-sessions/open', {
      headers: authHeaders(),
      query: { exerciseId: props.exercise.id },
    })
    if (sessionId) {
      const info = await $fetch<SessionInfo>(`/api/context-sessions/${sessionId}`, {
        headers: authHeaders(),
      })
      session.value = info
      answer.value = info.answer ?? ''
      for (const id of info.selected) {
        try {
          const granted = await $fetch<{ content: string; tokensSpent: number }>(
            `/api/context-sessions/${sessionId}/sources`,
            { method: 'POST', headers: authHeaders(), body: { sourceId: id } }
          )
          contents.value.set(id, granted.content)
          tokensSpent.value = granted.tokensSpent
        } catch {
          /* the row stays purchasable-looking; a click re-fetches */
        }
      }
      phase.value = 'live'
      return
    }
  } catch {
    // Fall through; starting will surface any real error.
  }
  phase.value = 'fresh'
})

async function start() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const created = await $fetch<{ id: string; sources: MenuSource[] }>('/api/context-sessions', {
      method: 'POST',
      headers: authHeaders(),
      body: { exerciseId: props.exercise.id },
    })
    session.value = {
      id: created.id,
      status: 'open',
      sources: created.sources,
      selected: [],
      answer: null,
    }
    phase.value = 'live'
    analytics.emit('context-session-started', { exercise: props.exercise.id })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Could not start the session'
  } finally {
    busy.value = false
  }
}

async function buy(source: MenuSource) {
  if (!session.value || buying.value) return
  buying.value = source.id
  error.value = ''
  try {
    const granted = await $fetch<{ content: string; tokensSpent: number; alreadyHeld: boolean }>(
      `/api/context-sessions/${session.value.id}/sources`,
      { method: 'POST', headers: authHeaders(), body: { sourceId: source.id } }
    )
    contents.value.set(source.id, granted.content)
    tokensSpent.value = granted.tokensSpent
    if (!session.value.selected.includes(source.id)) {
      session.value = {
        ...session.value,
        selected: [...session.value.selected, source.id],
      }
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Could not buy the source'
  } finally {
    buying.value = null
  }
}

async function submit() {
  if (!session.value || busy.value || !answer.value.trim()) return
  busy.value = true
  error.value = ''
  try {
    report.value = await $fetch<Report>(`/api/context-sessions/${session.value.id}/answer`, {
      method: 'POST',
      headers: authHeaders(),
      body: { answer: answer.value },
    })
    phase.value = 'submitted'
    analytics.emit('context-session-answered', {
      exercise: props.exercise.id,
      correct: report.value.correct,
      sufficient: report.value.sufficient,
    })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Submitting failed'
  } finally {
    busy.value = false
  }
}

const verdictLine = computed(() => {
  if (!report.value) return ''
  const r = report.value
  if (r.correct && r.sufficient) return 'correct, and the model had what it needed'
  if (r.correct && !r.sufficient)
    return 'correct — but something the answer needed was never handed over. That is a lucky guess, and it will not survive a schema you do not already know.'
  if (!r.correct && r.sufficient) return 'not correct — the context was there; the answer was not'
  return 'not correct, and something needed was never handed over'
})
</script>

<template>
  <div class="min-h-0 flex-1 overflow-auto p-5 md:p-6">
    <div class="mx-auto max-w-3xl">
      <!-- The running total, always in view. -->
      <div class="mb-6 flex flex-wrap items-center gap-3">
        <span class="eyebrow">spent</span>
        <span class="font-mono text-sm">{{ runningTotal }} tokens</span>
        <span class="font-mono text-xs text-muted-foreground">
          — buying is forever; un-seeing is not for sale
        </span>
      </div>

      <div v-if="phase === 'loading'" class="py-8" role="status">
        <div class="h-4 w-48 animate-pulse rounded bg-muted" aria-hidden="true" />
        <span class="sr-only">Loading session…</span>
      </div>

      <!-- Fresh: the rules before the till opens. -->
      <div v-else-if="phase === 'fresh'" class="max-w-2xl">
        <div class="mb-6 border-l-2 border-signal bg-signal/5 p-4 text-sm leading-relaxed">
          <p class="mb-2">
            The question below cannot be answered without being shown something. Sources are on a
            menu with prices; buy only what the answer actually needs. Handing over everything is
            allowed — and scored.
          </p>
          <p class="text-muted-foreground">
            Being right is the floor. Being right cheaply is the exercise. The session stays open
            until you answer; leaving and coming back resumes the same receipt.
          </p>
        </div>
        <Button :disabled="busy" :loading="busy" @click="start">Open the menu</Button>
      </div>

      <!-- Live: the menu as a receipt, then the answer. -->
      <template v-else-if="phase === 'live' && session">
        <div class="mb-8 border border-rule">
          <div
            v-for="source in session.sources"
            :key="source.id"
            class="border-b border-rule last:border-b-0"
          >
            <div
              class="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <p
                class="min-w-0 flex-1 break-words text-sm"
                :class="held.has(source.id) ? '' : 'text-muted-foreground'"
              >
                {{ source.label }}
              </p>
              <div class="flex shrink-0 items-center gap-3">
                <span class="font-mono text-xs text-muted-foreground">{{ source.tokens }} tok</span>
                <span v-if="held.has(source.id)" class="font-mono text-xs text-signal">held</span>
                <Button
                  v-else
                  variant="outline"
                  size="sm"
                  :disabled="buying !== null"
                  :loading="buying === source.id"
                  @click="buy(source)"
                >
                  Buy
                </Button>
              </div>
            </div>
            <!-- A bought row stays open. That is the receipt. -->
            <pre
              v-if="contents.get(source.id)"
              class="overflow-x-auto border-t border-rule bg-muted/40 px-4 py-3 font-mono text-xs leading-relaxed"
            ><code>{{ contents.get(source.id) }}</code></pre>
          </div>
        </div>

        <p class="eyebrow mb-2">your answer</p>
        <textarea
          v-model="answer"
          rows="5"
          placeholder="What would you write, given only what you bought?"
          class="mb-3 w-full rounded-lg border border-rule bg-background px-3 py-2 font-mono text-sm"
          :disabled="busy"
        />
        <Button :disabled="busy || !answer.trim()" :loading="busy" @click="submit">
          Answer — closes the receipt
        </Button>
      </template>

      <!-- Submitted: the itemised report. -->
      <template v-else-if="phase === 'submitted' && report">
        <p
          class="mb-6 font-mono text-sm"
          :class="report.correct && report.sufficient ? 'text-pass' : 'text-fail'"
        >
          {{ verdictLine }}
        </p>

        <div class="mb-6 max-w-md border border-rule">
          <div class="flex items-baseline justify-between border-b border-rule px-4 py-2">
            <span class="text-sm text-muted-foreground">correct</span>
            <span class="font-mono text-xs" :class="report.correct ? 'text-pass' : 'text-fail'">{{
              report.correct ? 'yes' : 'no'
            }}</span>
          </div>
          <div class="flex items-baseline justify-between border-b border-rule px-4 py-2">
            <span class="text-sm text-muted-foreground">sufficient context</span>
            <span
              class="font-mono text-xs"
              :class="report.sufficient ? 'text-pass' : 'text-fail'"
              >{{ report.sufficient ? 'yes' : 'no' }}</span
            >
          </div>
          <div class="flex items-baseline justify-between border-b border-rule px-4 py-2">
            <span class="text-sm text-muted-foreground">spent</span>
            <span class="font-mono text-xs">{{ report.tokensSpent }} tok</span>
          </div>
          <div class="flex items-baseline justify-between border-b border-rule px-4 py-2">
            <span class="text-sm text-muted-foreground">minimum that could answer</span>
            <span class="font-mono text-xs">{{ report.minimalTokens }} tok</span>
          </div>
          <div class="flex items-baseline justify-between px-4 py-2">
            <span class="text-sm text-muted-foreground">wasted</span>
            <span
              class="font-mono text-xs"
              :class="report.tokensWasted > 0 ? 'text-fail' : 'text-pass'"
              >{{ report.tokensWasted }} tok</span
            >
          </div>
        </div>

        <p v-if="report.unnecessary.length" class="mb-6 text-sm text-muted-foreground">
          Bought and never needed:
          <span class="break-words font-mono text-xs">{{
            report.unnecessary.map(labelOf).join(' · ')
          }}</span>
        </p>

        <div class="flex flex-wrap gap-3">
          <NuxtLink to="/review"
            ><Button variant="outline" size="sm">Review queue</Button></NuxtLink
          >
          <NuxtLink to="/tracks"><Button variant="outline" size="sm">Tracks</Button></NuxtLink>
        </div>
      </template>

      <p v-if="error" class="mt-4 text-sm text-fail">{{ error }}</p>
    </div>
  </div>
</template>
