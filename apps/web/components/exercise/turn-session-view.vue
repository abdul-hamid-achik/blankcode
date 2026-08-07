<script setup lang="ts">
import CodeEditor from '~/components/editor/code-editor.vue'
import Button from '~/components/ui/button.vue'
import { AUTH_COOKIE_OPTIONS } from '~/utils/auth-cookie'

/**
 * Form C: a graded conversation under a fixed budget.
 *
 * The transcript renders as a ledger, not a chat — chat styling invites
 * chatting, and the exercise is about spending messages deliberately. The
 * budget is always visible as slots; the composer states what sending costs
 * before you pay it; and the hidden suite appears only after the session is
 * closed and stamped, as the reward for finishing rather than an appendix.
 */

const props = defineProps<{
  exercise: {
    id: string
    title: string
    description: string
    starterCode: string
    turnBudget?: number | null
  }
  language: string
}>()

interface SessionState {
  id: string
  status: 'open' | 'submitted' | 'abandoned'
  maxTurns: number
  turnsUsed: number
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  finalCode: string | null
}

const session = ref<SessionState | null>(null)
const phase = ref<'loading' | 'fresh' | 'live' | 'submitted'>('loading')
const draft = ref('')
const code = ref(props.exercise.starterCode)
const busy = ref(false)
const error = ref('')

interface SubmitReport {
  passed: boolean
  turnsUsed: number
  maxTurns: number
  turnsSpared: number
  testResults: Array<{ name: string; passed: boolean; message: string | null }>
  errorMessage: string | null
}
const report = ref<SubmitReport | null>(null)
const revealedTests = ref<string | null>(null)

function authHeaders(): Record<string, string> {
  const token = useCookie<string | null>('token', AUTH_COOKIE_OPTIONS).value
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const turnsRemaining = computed(() =>
  session.value ? Math.max(0, session.value.maxTurns - session.value.turnsUsed) : 0
)

/** The budget as slots: spent ones fill, the rest wait. */
const slots = computed(() => {
  const max = session.value?.maxTurns ?? props.exercise.turnBudget ?? 0
  const used = session.value?.turnsUsed ?? 0
  return Array.from({ length: max }, (_, i) => i < used)
})

// Resume beats restart: the DB allows one open session per exercise, and a
// refresh mid-session must land back inside it, not in front of a wall.
onMounted(async () => {
  try {
    const { sessionId } = await $fetch<{ sessionId: string | null }>('/api/turn-sessions/open', {
      headers: authHeaders(),
      query: { exerciseId: props.exercise.id },
    })
    if (sessionId) {
      session.value = await $fetch<SessionState>(`/api/turn-sessions/${sessionId}`, {
        headers: authHeaders(),
      })
      code.value = session.value.finalCode ?? code.value
      phase.value = 'live'
      return
    }
  } catch {
    // Fall through to the fresh state; starting will surface any real error.
  }
  phase.value = 'fresh'
})

async function start() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const created = await $fetch<{ id: string; maxTurns: number; turnsUsed: number }>(
      '/api/turn-sessions',
      { method: 'POST', headers: authHeaders(), body: { exerciseId: props.exercise.id } }
    )
    session.value = {
      id: created.id,
      status: 'open',
      maxTurns: created.maxTurns,
      turnsUsed: created.turnsUsed,
      messages: [],
      finalCode: null,
    }
    phase.value = 'live'
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Could not start the session'
  } finally {
    busy.value = false
  }
}

async function send() {
  if (!session.value || busy.value || !draft.value.trim() || turnsRemaining.value <= 0) return
  busy.value = true
  error.value = ''
  const message = draft.value
  try {
    const result = await $fetch<{ reply: string; turnsUsed: number; turnsRemaining: number }>(
      `/api/turn-sessions/${session.value.id}/turns`,
      { method: 'POST', headers: authHeaders(), body: { message } }
    )
    session.value = {
      ...session.value,
      turnsUsed: result.turnsUsed,
      messages: [
        ...session.value.messages,
        { role: 'user', content: message },
        { role: 'assistant', content: result.reply },
      ],
    }
    draft.value = ''
  } catch (e) {
    // The turn may already be spent (that is the honest accounting when the
    // model call fails after the charge) — reload the session so the ledger
    // never disagrees with the database.
    error.value = e instanceof Error ? e.message : 'The turn failed'
    try {
      session.value = await $fetch<SessionState>(`/api/turn-sessions/${session.value.id}`, {
        headers: authHeaders(),
      })
    } catch {
      /* keep the local state if even the reload fails */
    }
  } finally {
    busy.value = false
  }
}

async function submit() {
  if (!session.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const result = await $fetch<{
      outcome: { passed: boolean; turnsUsed: number; maxTurns: number; turnsSpared: number }
      testsReleased: boolean
      testResults: SubmitReport['testResults']
      errorMessage: string | null
    }>(`/api/turn-sessions/${session.value.id}/submit`, {
      method: 'POST',
      headers: authHeaders(),
      body: { code: code.value },
    })
    report.value = {
      ...result.outcome,
      testResults: result.testResults,
      errorMessage: result.errorMessage,
    }
    phase.value = 'submitted'
    // The suite, released now that the session has earned it. Pedagogical
    // reward, not appendix: reading the tests you were graded by is where
    // the lesson about specification lands.
    if (result.testsReleased) {
      try {
        const tests = await $fetch<{ testCode: string }>(
          `/api/turn-sessions/${session.value.id}/tests`,
          { headers: authHeaders() }
        )
        revealedTests.value = tests.testCode
      } catch {
        /* the report stands without it */
      }
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Submitting failed'
  } finally {
    busy.value = false
  }
}

const spareLine = computed(() => {
  if (!report.value) return ''
  const { passed, turnsUsed, maxTurns, turnsSpared } = report.value
  if (!passed) return `not yet — ${turnsUsed} of ${maxTurns} spent`
  if (turnsSpared > 0) {
    return `solved in ${turnsUsed} of ${maxTurns} — ${turnsSpared === 1 ? 'one turn' : `${turnsSpared} turns`} spared`
  }
  return `solved in ${turnsUsed} of ${maxTurns}`
})
</script>

<template>
  <div class="min-h-0 flex-1 overflow-auto p-5 md:p-6">
    <div class="mx-auto max-w-3xl">
      <!-- The budget, always in view. -->
      <div class="mb-6 flex items-center gap-3">
        <span class="eyebrow">budget</span>
        <div class="flex gap-1.5" aria-label="Turns used">
          <span
            v-for="(spent, i) in slots"
            :key="i"
            class="inline-block h-2.5 w-8 rounded-sm border"
            :class="spent ? 'border-signal bg-signal' : 'border-rule bg-transparent'"
          />
        </div>
        <span class="font-mono text-xs text-muted-foreground">
          {{ session ? `${turnsRemaining} remaining` : `${exercise.turnBudget} messages` }}
        </span>
      </div>

      <div v-if="phase === 'loading'" class="py-8" role="status">
        <div class="h-4 w-48 animate-pulse rounded bg-muted" aria-hidden="true" />
        <span class="sr-only">Loading session…</span>
      </div>

      <!-- Fresh: the rules, stated before the meter starts. -->
      <div v-else-if="phase === 'fresh'" class="max-w-2xl">
        <div class="mb-6 border-l-2 border-signal bg-signal/5 p-4 text-sm leading-relaxed">
          <p class="mb-2">
            You get <strong>{{ exercise.turnBudget }} messages</strong> to a model. The suite you
            are graded against stays hidden until you submit. A turn is spent the moment you send —
            the model failing to be useful does not refund it.
          </p>
          <p class="text-muted-foreground">
            Submitting with turns in hand is a better result, and the report will say so. Once you
            start, the session stays open until you submit — leaving and coming back resumes it.
          </p>
        </div>
        <Button :disabled="busy" :loading="busy" @click="start">Start the session</Button>
      </div>

      <!-- Live: ledger, composer, code panel. -->
      <template v-else-if="phase === 'live' && session">
        <ol v-if="session.messages.length" class="mb-6 border border-rule">
          <li
            v-for="(message, i) in session.messages"
            :key="i"
            class="border-b border-rule px-4 py-3 last:border-b-0"
          >
            <p class="eyebrow mb-1.5">
              {{ message.role === 'user' ? `turn ${Math.floor(i / 2) + 1} — you` : 'the model' }}
            </p>
            <p class="whitespace-pre-wrap text-sm leading-relaxed">{{ message.content }}</p>
          </li>
        </ol>

        <div v-if="turnsRemaining > 0" class="mb-8">
          <textarea
            v-model="draft"
            rows="4"
            :placeholder="
              session.messages.length === 0
                ? 'Your first message. Spend it on the whole shape — including what should happen when things fail.'
                : 'Read what came back. What did you not specify?'
            "
            class="w-full rounded-lg border border-rule bg-background px-3 py-2 font-mono text-sm"
            :disabled="busy"
          />
          <div class="mt-2 flex items-center justify-between gap-3">
            <p class="font-mono text-xs text-muted-foreground">
              sending spends 1 of {{ turnsRemaining }} remaining
            </p>
            <Button size="sm" :disabled="busy || !draft.trim()" :loading="busy" @click="send">
              Send
            </Button>
          </div>
        </div>
        <p v-else class="mb-8 border-l-2 border-rule-strong pl-3 text-sm text-muted-foreground">
          The budget is spent. What remains is the judgement call this exercise is actually about:
          decide the code is right, and submit it.
        </p>

        <div class="mb-3 flex items-baseline justify-between">
          <p class="eyebrow">the code you will submit</p>
          <p class="font-mono text-xs text-muted-foreground">
            edit freely — turns buy messages, not keystrokes
          </p>
        </div>
        <div class="mb-4 overflow-hidden rounded border border-rule">
          <ClientOnly>
            <CodeEditor
              :code="code"
              :language="language"
              :blanks="[]"
              :blank-values="new Map()"
              @update:code="(value: string) => (code = value)"
            />
          </ClientOnly>
        </div>
        <Button :disabled="busy" :loading="busy" @click="submit">
          Submit — ends the session
        </Button>
      </template>

      <!-- Submitted: the report, and the suite as the reward. -->
      <template v-else-if="phase === 'submitted' && report">
        <p class="mb-1 font-mono text-sm" :class="report.passed ? 'text-pass' : 'text-fail'">
          {{ spareLine }}
        </p>
        <p class="mb-6 text-sm text-muted-foreground">
          {{
            report.passed
              ? 'The suite you never saw agrees with the code you specified.'
              : 'The hidden suite found what the conversation did not pin down.'
          }}
        </p>

        <div v-if="report.testResults.length" class="mb-6 border border-rule">
          <div
            v-for="test in report.testResults"
            :key="test.name"
            class="flex items-baseline gap-3 border-b border-rule px-4 py-2 last:border-b-0"
          >
            <span
              class="shrink-0 font-mono text-xs"
              :class="test.passed ? 'text-pass' : 'text-fail'"
              >{{ test.passed ? 'pass' : 'fail' }}</span
            >
            <span class="min-w-0 flex-1 text-sm">{{ test.name }}</span>
          </div>
        </div>
        <p v-if="report.errorMessage" class="mb-6 font-mono text-xs text-fail">
          {{ report.errorMessage }}
        </p>

        <div v-if="revealedTests" class="mb-6">
          <p class="eyebrow mb-2">the suite you were graded by — released now that it is over</p>
          <pre
            class="overflow-x-auto rounded border border-rule bg-muted/40 p-4 font-mono text-xs leading-relaxed"
          ><code>{{ revealedTests }}</code></pre>
        </div>

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
