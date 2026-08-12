<script setup lang="ts">
import CodeEditor from '~/components/editor/code-editor.vue'
import Button from '~/components/ui/button.vue'
import { useAnalytics } from '~/composables/useAnalytics'
import { AUTH_COOKIE_OPTIONS } from '~/utils/auth-cookie'
import {
  actionLabel,
  budgetSlots,
  falseAlarmCopy,
  finalCallCopy,
  pendingCopy,
  type TestRow,
  testsFromEvidence,
} from '~/utils/agent-session-view'

/**
 * Supervision sitting: claims on the left, evidence on the right, the agent's
 * current code below. Chat styling would invite chatting; this is a ledger.
 */

const analytics = useAnalytics()

const props = defineProps<{
  exercise: { id: string; title: string; description: string }
  language: string
  conceptSlug?: string
}>()

type Action = 'approve' | 'reject' | 'interrupt' | 'demand-evidence' | 'redirect'

interface SessionView {
  id: string
  status: 'open' | 'submitted' | 'abandoned'
  beatIndex: number
  beat: { say: string; run: boolean; hasCode: boolean } | null
  currentCode: string | null
  ledger: Array<{
    kind: 'agent' | 'you'
    say?: string
    run?: boolean
    action?: string
    beatIndex: number
  }>
  evidence: { passed: boolean; testResults?: TestRow[]; errorMessage?: string | null } | null
  agentTurnsUsed: number
  maxAgentTurns: number
  interventionsUsed: number
  maxInterventions: number
  report: {
    passed: boolean
    score: number
    maxScore: number
    seeds: Array<{ kind: string; verdict: string; truth: string; awarded: number; weight: number }>
    finalCallCorrect: boolean
    falseAlarms: number
    falseAlarmAwarded: number
    falseAlarmWeight: number
  } | null
}

const session = ref<SessionView | null>(null)
const phase = ref<'loading' | 'fresh' | 'live' | 'submitted'>('loading')
const busy = ref(false)
const error = ref('')
const redirectNote = ref('')
const closing = ref(false)
const pending = ref<'start' | 'decide' | 'close' | null>(null)
const revealedTests = ref<string | null>(null)
const closeTests = ref<TestRow[]>([])
const closeError = ref<string | null>(null)
const drilling = ref(false)
const drillError = ref('')

function authHeaders(): Record<string, string> {
  const token = useCookie<string | null>('token', AUTH_COOKIE_OPTIONS).value
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const interventionsLeft = computed(() =>
  session.value ? Math.max(0, session.value.maxInterventions - session.value.interventionsUsed) : 0
)

const interventionSlots = computed(() =>
  budgetSlots(session.value?.interventionsUsed ?? 0, session.value?.maxInterventions ?? 0)
)

const agentSlots = computed(() =>
  budgetSlots(session.value?.agentTurnsUsed ?? 0, session.value?.maxAgentTurns ?? 0)
)

const statusLine = computed(() => pendingCopy(pending.value))

async function hydrate(view: SessionView) {
  session.value = view
  closeTests.value = testsFromEvidence(view.evidence)
  closeError.value = view.evidence?.errorMessage ?? null
  if (view.status === 'open') {
    phase.value = 'live'
    return
  }
  phase.value = 'submitted'
  try {
    const payload = await $fetch<{ tests: string }>(`/api/agent-sessions/${view.id}/tests`, {
      headers: authHeaders(),
    })
    revealedTests.value = payload.tests
  } catch {
    // Closed sittings without a stamp still render the report.
  }
}

onMounted(async () => {
  try {
    const { sessionId } = await $fetch<{ sessionId: string | null }>('/api/agent-sessions/open', {
      headers: authHeaders(),
      query: { exerciseId: props.exercise.id },
    })
    if (sessionId) {
      const view = await $fetch<SessionView>(`/api/agent-sessions/${sessionId}`, {
        headers: authHeaders(),
      })
      await hydrate(view)
      return
    }
  } catch {
    // Fall through to start.
  }
  phase.value = 'fresh'
})

async function start() {
  if (busy.value) return
  busy.value = true
  pending.value = 'start'
  error.value = ''
  try {
    const view = await $fetch<SessionView>('/api/agent-sessions', {
      method: 'POST',
      headers: authHeaders(),
      body: { exerciseId: props.exercise.id },
    })
    await hydrate(view)
    analytics.emit('agent-session-started', { exercise: props.exercise.id })
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Could not start the sitting'
  } finally {
    busy.value = false
    pending.value = null
  }
}

async function decide(action: Action) {
  if (!session.value || busy.value) return
  if (action === 'redirect' && !redirectNote.value.trim()) return
  busy.value = true
  pending.value = 'decide'
  error.value = ''
  try {
    session.value = await $fetch<SessionView>(`/api/agent-sessions/${session.value.id}/decide`, {
      method: 'POST',
      headers: authHeaders(),
      body: { action, note: action === 'redirect' ? redirectNote.value : undefined },
    })
    closeTests.value = testsFromEvidence(session.value.evidence)
    closeError.value = session.value.evidence?.errorMessage ?? null
    redirectNote.value = ''
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Could not record that'
  } finally {
    busy.value = false
    pending.value = null
  }
}

async function closeSitting(action: 'accept-work' | 'reject-work') {
  if (!session.value || busy.value) return
  busy.value = true
  closing.value = true
  pending.value = 'close'
  error.value = ''
  try {
    const view = await $fetch<
      SessionView & { testResults?: TestRow[]; errorMessage?: string | null }
    >(`/api/agent-sessions/${session.value.id}/close`, {
      method: 'POST',
      headers: authHeaders(),
      body: { action },
    })
    await hydrate(view)
    if (view.testResults?.length) closeTests.value = view.testResults
    if (view.errorMessage) closeError.value = view.errorMessage
    analytics.emit('agent-session-closed', { exercise: props.exercise.id, action })
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Could not close the sitting'
  } finally {
    busy.value = false
    closing.value = false
    pending.value = null
  }
}

async function drillThisConcept() {
  if (!props.conceptSlug || drilling.value) return
  drilling.value = true
  drillError.value = ''
  try {
    const result = await $fetch<{ drill: { id: string } }>('/api/drills/generate', {
      method: 'POST',
      headers: authHeaders(),
      body: { conceptSlug: props.conceptSlug },
    })
    await navigateTo(`/drills/${result.drill.id}`)
  } catch (caught) {
    drillError.value =
      caught instanceof Error
        ? caught.message
        : 'The drill was not generated. Nothing was saved \u2014 try again.'
  } finally {
    drilling.value = false
  }
}
</script>

<template>
  <div class="min-h-0 flex-1 overflow-auto p-5 md:p-6">
    <div class="mx-auto max-w-3xl">
      <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div class="flex flex-wrap items-center gap-3">
          <span class="eyebrow">agent</span>
          <div class="flex flex-wrap gap-1.5" aria-label="Agent turns used">
            <span
              v-for="(spent, i) in agentSlots"
              :key="`a-${i}`"
              class="inline-block h-2.5 w-8 rounded-sm border"
              :class="spent ? 'border-rule-strong bg-foreground/70' : 'border-rule bg-transparent'"
            />
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <span class="eyebrow">interventions</span>
          <div class="flex flex-wrap gap-1.5" aria-label="Interventions used">
            <span
              v-for="(spent, i) in interventionSlots"
              :key="`i-${i}`"
              class="inline-block h-2.5 w-8 rounded-sm border"
              :class="spent ? 'border-signal bg-signal' : 'border-rule bg-transparent'"
            />
          </div>
          <span class="font-mono text-xs text-muted-foreground">
            {{
              session ? `${interventionsLeft} remaining` : 'approve is free — the rest costs one'
            }}
          </span>
        </div>
      </div>

      <div v-if="phase === 'loading'" class="py-8" role="status">
        <div class="h-4 w-48 animate-pulse rounded bg-muted" aria-hidden="true" />
        <span class="sr-only">Loading sitting…</span>
      </div>

      <div v-else-if="phase === 'fresh'" class="max-w-2xl">
        <div class="mb-6 border-l-2 border-signal bg-signal/5 p-4 text-sm leading-relaxed">
          <p class="mb-2">
            An agent will work this task. Failures are seeded. You are graded on
            <strong>catching them</strong> — not on whether the code ends up green.
          </p>
          <p class="text-muted-foreground">
            Approve is free. Reject, interrupt, demand evidence, or redirect costs one intervention.
            Accepting a pass the suite did not produce is the miss that fails the sitting.
          </p>
        </div>
        <Button :disabled="busy" :loading="busy" @click="start">Start supervising</Button>
        <p v-if="statusLine" class="mt-3 font-mono text-xs text-muted-foreground" role="status">
          {{ statusLine }}
        </p>
      </div>

      <template v-else-if="(phase === 'live' || phase === 'submitted') && session">
        <div class="mb-6 grid gap-4 md:grid-cols-2">
          <div class="border border-rule">
            <p class="eyebrow border-b border-rule px-4 py-2">claims</p>
            <ol>
              <li
                v-for="(entry, i) in session.ledger"
                :key="i"
                class="border-b border-rule px-4 py-3 last:border-b-0"
                :class="
                  phase === 'live' && i === session.ledger.length - 1 ? 'bg-signal/5' : undefined
                "
              >
                <p class="eyebrow mb-1.5">
                  {{ entry.kind === 'agent' ? `beat ${entry.beatIndex + 1} — agent` : 'you' }}
                </p>
                <p v-if="entry.kind === 'agent'" class="text-sm leading-relaxed">{{ entry.say }}</p>
                <p v-else class="font-mono text-sm">{{ actionLabel(entry.action ?? '') }}</p>
                <p
                  v-if="entry.kind === 'agent'"
                  class="mt-1 font-mono text-xs text-muted-foreground"
                >
                  {{ entry.run ? 'said they ran the suite' : 'no run behind this claim' }}
                </p>
              </li>
            </ol>
          </div>
          <div class="border border-rule">
            <p class="eyebrow border-b border-rule px-4 py-2">evidence</p>
            <div class="px-4 py-3 text-sm leading-relaxed">
              <p
                v-if="session.evidence"
                :class="session.evidence.passed ? 'text-pass' : 'text-fail'"
              >
                Last run: {{ session.evidence.passed ? 'the suite passed' : 'the suite failed' }}.
              </p>
              <p v-else class="text-muted-foreground">
                No run on record. A claim of green without a run is the thing you are here to catch.
              </p>
              <p v-if="session.evidence?.errorMessage" class="mt-2 font-mono text-xs text-fail">
                {{ session.evidence.errorMessage }}
              </p>
              <ul
                v-if="session.evidence?.testResults?.length"
                class="mt-3 border-t border-rule pt-3"
              >
                <li
                  v-for="test in session.evidence.testResults"
                  :key="test.name"
                  class="flex items-baseline gap-3 py-1"
                >
                  <span
                    class="shrink-0 font-mono text-xs"
                    :class="test.passed ? 'text-pass' : 'text-fail'"
                  >
                    {{ test.passed ? 'pass' : 'fail' }}
                  </span>
                  <span class="min-w-0 flex-1 text-xs">{{ test.name }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div v-if="session.currentCode" class="mb-8">
          <p class="eyebrow mb-2">the agent's current code</p>
          <div class="min-h-48 overflow-hidden rounded border border-rule">
            <ClientOnly>
              <CodeEditor
                :code="session.currentCode"
                :language="language"
                :readonly="true"
                :blanks="[]"
                :blank-values="new Map()"
              />
              <template #fallback>
                <pre class="max-h-96 overflow-auto p-4 font-mono text-xs leading-relaxed">{{
                  session.currentCode
                }}</pre>
              </template>
            </ClientOnly>
          </div>
          <p class="mt-2 font-mono text-xs text-muted-foreground">
            read-only — you supervise, you do not type the fix
          </p>
        </div>

        <p v-if="statusLine" class="mb-4 font-mono text-xs text-muted-foreground" role="status">
          {{ statusLine }}
        </p>

        <template v-if="phase === 'live'">
          <div class="mb-6 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" :disabled="busy" @click="decide('approve')">
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              :disabled="busy || interventionsLeft <= 0"
              @click="decide('reject')"
            >
              Reject
            </Button>
            <Button
              size="sm"
              variant="outline"
              :disabled="busy || interventionsLeft <= 0"
              @click="decide('demand-evidence')"
            >
              Demand evidence
            </Button>
            <Button
              size="sm"
              variant="outline"
              :disabled="busy || interventionsLeft <= 0"
              @click="decide('interrupt')"
            >
              Interrupt
            </Button>
          </div>

          <div class="mb-8 flex flex-wrap items-end gap-2">
            <label class="min-w-0 flex-1">
              <span class="sr-only">Redirect instruction</span>
              <input
                v-model="redirectNote"
                type="text"
                :disabled="busy || interventionsLeft <= 0"
                placeholder="Redirect — one short instruction"
                class="w-full border border-rule bg-background px-3 py-2 font-sans text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
              />
            </label>
            <Button
              size="sm"
              variant="outline"
              :disabled="busy || interventionsLeft <= 0 || !redirectNote.trim()"
              @click="decide('redirect')"
            >
              Redirect
            </Button>
          </div>

          <div class="flex flex-wrap gap-3">
            <Button :disabled="busy" :loading="closing" @click="closeSitting('accept-work')">
              Accept the work
            </Button>
            <Button
              variant="outline"
              :disabled="busy"
              :loading="closing"
              @click="closeSitting('reject-work')"
            >
              Reject the work
            </Button>
          </div>
        </template>

        <template v-else-if="session.report">
          <p
            class="mb-1 font-mono text-sm"
            :class="session.report.passed ? 'text-pass' : 'text-fail'"
          >
            {{ session.report.score }} / {{ session.report.maxScore }}
            {{ session.report.passed ? ' — the sitting holds' : ' — the sitting does not hold' }}
          </p>
          <p class="mb-2 text-sm text-muted-foreground">
            {{ finalCallCopy(session.report.finalCallCorrect) }}
          </p>
          <p class="mb-6 text-sm text-muted-foreground">
            {{
              falseAlarmCopy(
                session.report.falseAlarms,
                session.report.falseAlarmAwarded,
                session.report.falseAlarmWeight
              )
            }}
          </p>
          <ul class="mb-6 border border-rule">
            <li
              v-for="seed in session.report.seeds"
              :key="`${seed.kind}-${seed.truth}`"
              class="border-b border-rule px-4 py-3 last:border-b-0"
            >
              <p class="eyebrow mb-1">{{ seed.kind }} · {{ seed.verdict }}</p>
              <p class="text-sm leading-relaxed">{{ seed.truth }}</p>
              <p class="mt-1 font-mono text-xs text-muted-foreground">
                {{ seed.awarded }} / {{ seed.weight }}
              </p>
            </li>
          </ul>
          <div v-if="closeTests.length" class="mb-6 border border-rule">
            <div
              v-for="test in closeTests"
              :key="test.name"
              class="flex items-baseline gap-3 border-b border-rule px-4 py-2 last:border-b-0"
            >
              <span
                class="shrink-0 font-mono text-xs"
                :class="test.passed ? 'text-pass' : 'text-fail'"
              >
                {{ test.passed ? 'pass' : 'fail' }}
              </span>
              <span class="min-w-0 flex-1 text-sm">{{ test.name }}</span>
            </div>
          </div>
          <p v-if="closeError" class="mb-6 font-mono text-xs text-fail">{{ closeError }}</p>
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
            <Button
              v-if="!session.report.passed && conceptSlug"
              variant="outline"
              size="sm"
              :disabled="drilling"
              :loading="drilling"
              @click="drillThisConcept"
            >
              Drill this concept
            </Button>
          </div>
          <p v-if="drilling" class="mt-3 font-mono text-xs text-muted-foreground" role="status">
            building and running your drill — it must pass its own tests before you see it
          </p>
          <p v-else-if="drillError" class="mt-3 font-mono text-xs text-fail" role="alert">
            {{ drillError }}
          </p>
        </template>
      </template>

      <p v-if="error" class="mt-4 text-sm text-fail" role="alert">{{ error }}</p>
    </div>
  </div>
</template>
