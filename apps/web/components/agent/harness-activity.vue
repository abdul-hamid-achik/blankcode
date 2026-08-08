<script setup lang="ts">
import { AUTH_COOKIE_OPTIONS } from '~/utils/auth-cookie'
import { relativeTime } from '~/utils/relative-time'

/**
 * Agent practice, read back to the human who holds the token.
 *
 * Same `harness_sessions` rows the MCP endpoint writes on every tool call —
 * this just reads the last 10 back. Bookkeeping, not surveillance: it says
 * what happened, in the open, on the page the account owner already reads.
 * Renders nothing when there is nothing to report; an empty ledger with a
 * heading is a worse answer than no ledger at all.
 */

interface HarnessSession {
  clientName: string | null
  clientVersion: string | null
  toolCalls: number
  startedAt: string
  lastSeenAt: string
}

const sessions = ref<HarnessSession[]>([])
const totals = ref<{ sessions: number; toolCalls: number }>({ sessions: 0, toolCalls: 0 })

function authHeaders(): Record<string, string> {
  const token = useCookie<string | null>('token', AUTH_COOKIE_OPTIONS).value
  return token ? { Authorization: `Bearer ${token}` } : {}
}

onMounted(async () => {
  try {
    const result = await $fetch<{
      sessions: HarnessSession[]
      totals: { sessions: number; toolCalls: number }
    }>('/api/account/harness-sessions', { headers: authHeaders() })
    sessions.value = result.sessions
    totals.value = result.totals
  } catch {
    // No activity to report reads the same as a failed fetch here — either
    // way the honest default is to say nothing rather than guess.
  }
})

function clientLabel(session: HarnessSession): string {
  return session.clientName ?? 'unknown harness'
}
</script>

<template>
  <div v-if="sessions.length">
    <p class="eyebrow mb-2">agent practice</p>
    <ol class="border border-rule">
      <li
        v-for="(session, i) in sessions"
        :key="i"
        class="flex items-baseline justify-between gap-3 border-b border-rule px-4 py-2.5 last:border-b-0"
      >
        <span class="min-w-0 flex-1 truncate text-sm">{{ clientLabel(session) }}</span>
        <span class="shrink-0 font-mono text-xs text-muted-foreground">
          {{ session.toolCalls }} {{ session.toolCalls === 1 ? 'tool call' : 'tool calls' }} ·
          {{ relativeTime(session.lastSeenAt) }}
        </span>
      </li>
    </ol>
    <p class="mt-2 font-mono text-xs text-muted-foreground">
      {{ totals.sessions }} {{ totals.sessions === 1 ? 'session' : 'sessions' }} on record ·
      {{ totals.toolCalls }} tool {{ totals.toolCalls === 1 ? 'call' : 'calls' }} total
    </p>
  </div>
</template>
