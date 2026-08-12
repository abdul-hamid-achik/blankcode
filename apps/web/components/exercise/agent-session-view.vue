<script setup lang="ts">
import Button from '~/components/ui/button.vue'
import { useAnalytics } from '~/composables/useAnalytics'
import { AUTH_COOKIE_OPTIONS } from '~/utils/auth-cookie'

/**
 * Supervision sitting: claims on the left, evidence on the right, a small
 * vocabulary of interventions. Chat styling would invite chatting; this is
 * a ledger of what the agent claimed and what you did about it.
 */

const analytics = useAnalytics()

const props = defineProps<{
  exercise: { id: string; title: string; description: string }
}>()

type Action = 'approve' | 'reject' | 'interrupt' | 'demand-evidence' | 'redirect'

interface SessionView {
  id: string
  status: 'open' | 'submitted' | 'abandoned'
  beatIndex: number
  beat: { say: string; run: boolean; hasCode: boolean } | null
  ledger: Array<{
    kind: 'agent' | 'you'
    say?: string
    run?: boolean
    action?: string
    beatIndex: number
  }>
  evidence: { passed: boolean } | null
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
  } | null
}

const session = ref<SessionView | null>(null)
const phase = ref<'loading' | 'fresh' | 'live' | 'submitted'>('loading')
const busy = ref(false)
const error = ref('')
const redirectNote = ref('')
const closing = ref(false)

function authHeaders(): Record<string, string> {
  const token = useCookie<string | null>('token', AUTH_COOKIE_OPTIONS).value
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const interventionsLeft = computed(() =>
  session.value ? Math.max(0, session.value.maxInterventions - session.value.interventionsUsed) : 0
)

const interventionSlots = computed(() => {
  const max = session.value?.maxInterventions ?? 0
  const used = session.value?.interventionsUsed ?? 0
  return Array.from({ length: max }, (_, i) => i < used)
})

onMounted(async () => {
  try {
    const { sessionId } = await $fetch<{ sessionId: string | null }>('/api/agent-sessions/open', {
      headers: authHeaders(),
      query: { exerciseId: props.exercise.id },
    })
    if (sessionId) {
      session.value = await $fetch<SessionView>(`/api/agent-sessions/${sessionId}`, {
        headers: authHeaders(),
      })
      phase.value = session.value.status === 'open' ? 'live' : 'submitted'
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
  error.value = ''
  try {
    session.value = await $fetch<SessionView>('/api/agent-sessions', {
      method: 'POST',
      headers: authHeaders(),
      body: { exerciseId: props.exercise.id },
    })
    phase.value = 'live'
    analytics.emit('agent-session-started', { exercise: props.exercise.id })
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Could not start the sitting'
  } finally {
    busy.value = false
  }
}

async function decide(action: Action) {
  if (!session.value || busy.value) return
  if (action === 'redirect' && !redirectNote.value.trim()) return
  busy.value = true
  error.value = ''
  try {
    session.value = await $fetch<SessionView>(`/api/agent-sessions/${session.value.id}/decide`, {
      method: 'POST',
      headers: authHeaders(),
      body: { action, note: action === 'redirect' ? redirectNote.value : undefined },
    })
    redirectNote.value = ''
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Could not record that'
  } finally {
    busy.value = false
  }
}

async function closeSitting(action: 'accept-work' | 'reject-work') {
  if (!session.value || busy.value) return
  busy.value = true
  closing.value = true
  error.value = ''
  try {
    session.value = await $fetch<SessionView>(`/api/agent-sessions/${session.value.id}/close`, {
      method: 'POST',
      headers: authHeaders(),
      body: { action },
    })
    phase.value = 'submitted'
    analytics.emit('agent-session-closed', { exercise: props.exercise.id, action })
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Could not close the sitting'
  } finally {
    busy.value = false
    closing.value = false
  }
}

function actionLabel(action: string): string {
  if (action === 'demand-evidence') return 'demanded evidence'
  if (action === 'accept-work') return 'accepted the work'
  if (action === 'reject-work') return 'rejected the work'
  return action
}
</script>

<template>
  <div class="min-h-0 flex-1 overflow-auto p-5 md:p-6">
    <div class="mx-auto max-w-3xl">
      <div class="mb-6 flex flex-wrap items-center gap-3">
        <span class="eyebrow">interventions</span>
        <div class="flex flex-wrap gap-1.5" aria-label="Interventions used">
          <span
            v-for="(spent, i) in interventionSlots"
            :key="i"
            class="inline-block h-2.5 w-8 rounded-sm border"
            :class="spent ? 'border-signal bg-signal' : 'border-rule bg-transparent'"
          />
        </div>
        <span class="font-mono text-xs text-muted-foreground">
          {{ session ? `${interventionsLeft} remaining` : 'approve is free — the rest costs one' }}
        </span>
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
      </div>

      <template v-else-if="phase === 'live' && session">
        <div class="mb-6 grid gap-4 md:grid-cols-2">
          <div class="border border-rule">
            <p class="eyebrow border-b border-rule px-4 py-2">claims</p>
            <ol>
              <li
                v-for="(entry, i) in session.ledger"
                :key="i"
                class="border-b border-rule px-4 py-3 last:border-b-0"
              >
                <p class="eyebrow mb-1.5">
                  {{ entry.kind === 'agent' ? `beat ${entry.beatIndex + 1} — agent` : 'you' }}
                </p>
                <p v-if="entry.kind === 'agent'" class="text-sm leading-relaxed">{{ entry.say }}</p>
                <p v-else class="font-mono text-sm">{{ actionLabel(entry.action ?? '') }}</p>
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
            </div>
          </div>
        </div>

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

      <template v-else-if="phase === 'submitted' && session?.report">
        <p
          class="mb-1 font-mono text-sm"
          :class="session.report.passed ? 'text-pass' : 'text-fail'"
        >
          {{ session.report.score }} / {{ session.report.maxScore }}
          {{ session.report.passed ? ' — the sitting holds' : ' — the sitting does not hold' }}
        </p>
        <p class="mb-6 text-sm text-muted-foreground">
          {{
            session.report.finalCallCorrect
              ? 'The final call matched what the suite actually did.'
              : 'The final call did not match the suite. Accepting a fail is the cardinal miss.'
          }}
        </p>
        <ul class="border border-rule">
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
      </template>

      <p v-if="error" class="mt-4 text-sm text-fail" role="alert">{{ error }}</p>
    </div>
  </div>
</template>
