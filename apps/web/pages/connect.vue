<script setup lang="ts">
import Button from '~/components/ui/button.vue'
import Card from '~/components/ui/card.vue'
import { usePageSeo } from '~/composables/usePageSeo'
import { useAnalytics } from '~/composables/useAnalytics'
import { useAuthStore } from '~/stores/auth'
import { AUTH_COOKIE_OPTIONS } from '~/utils/auth-cookie'
import { relativeTime } from '~/utils/relative-time'

/**
 * The page that IS the bring-your-own-agent feature — and it has two faces.
 *
 * Before the first tool call it is a setup guide: mint a key, copy the block
 * for your harness, done. Once a call has actually landed, the guide has done
 * its job, so it folds away and the page becomes the operating view: which
 * agent spoke last and when, what today's work amounted to, and the keys —
 * each one nameable, revocable, and one more always mintable for the next
 * agent. The flip runs on evidence (harness_sessions rows), not on hope; a
 * freshly minted, never-used key keeps the guide open and the page quietly
 * polls until the first call arrives.
 *
 * Public so it can be linked and read signed out; minting itself requires the
 * session, which is the security model — the page where you approve a new
 * key is always a page where you are you.
 */

definePageMeta({ requiresAuth: false })

const analytics = useAnalytics()
const auth = useAuthStore()
const site = (useRuntimeConfig().public['siteUrl'] as string).replace(/\/+$/, '')
const mcpUrl = computed(() => `${site}/mcp`)

const tokenName = ref('')
const busy = ref(false)
const error = ref('')
const minted = ref<{ token: string; name: string } | null>(null)
const copiedKey = ref<string | null>(null)

interface TokenRow {
  id: string
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
}
interface HarnessSession {
  clientName: string | null
  clientVersion: string | null
  toolCalls: number
  startedAt: string
  lastSeenAt: string
  tokenName: string | null
}
interface Activity {
  sessions: HarnessSession[]
  totals: { sessions: number; toolCalls: number }
  today: { runs: number; agentSubmissions: number }
}

const tokens = ref<TokenRow[]>([])
const activity = ref<Activity | null>(null)
/** null until the first successful fetch — before that, neither face is a lie. */
const loaded = ref(false)

const connected = computed(() => (activity.value?.sessions.length ?? 0) > 0)
const latest = computed(() => activity.value?.sessions[0] ?? null)
/** "Live" means a tool call within the last five minutes — same freshness the poll can honor. */
const liveNow = computed(() => {
  const seen = latest.value?.lastSeenAt
  return !!seen && Date.now() - new Date(seen).getTime() < 5 * 60 * 1000
})
/** A key exists but no call has landed: the state the polling exists for. */
const waitingForFirstCall = computed(
  () => auth.isAuthenticated && loaded.value && tokens.value.length > 0 && !connected.value
)

/** Collapsed once connected; springs open when a fresh key needs its snippet copied. */
const setupOpen = ref(false)

function headers(): Record<string, string> {
  const token = useCookie<string | null>('token', AUTH_COOKIE_OPTIONS).value
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function refresh() {
  if (!auth.isAuthenticated) return
  try {
    const wasConnected = connected.value
    const [tokenResult, activityResult] = await Promise.all([
      $fetch<{ tokens: TokenRow[] }>('/api/account/tokens', { headers: headers() }),
      $fetch<Activity>('/api/account/harness-sessions', { headers: headers() }),
    ])
    tokens.value = tokenResult.tokens
    activity.value = activityResult
    loaded.value = true
    if (!wasConnected && connected.value && loaded.value) {
      analytics.emit('agent-connected', { client: latest.value?.clientName ?? 'unknown' })
    }
  } catch {
    // A failed poll changes nothing on screen; the next one gets its chance.
  }
}

/**
 * Polling, paced by what the page is waiting for: every 8s while a minted key
 * has not spoken yet (the flip should feel immediate), every 30s once
 * connected (counters drift, they do not race), never when the tab is hidden.
 */
let pollTimer: ReturnType<typeof setTimeout> | null = null
function scheduleNextPoll() {
  if (pollTimer) clearTimeout(pollTimer)
  pollTimer = setTimeout(
    async () => {
      if (!document.hidden) await refresh()
      scheduleNextPoll()
    },
    waitingForFirstCall.value ? 8_000 : 30_000
  )
}
onMounted(async () => {
  await refresh()
  scheduleNextPoll()
})
onBeforeUnmount(() => {
  if (pollTimer) clearTimeout(pollTimer)
})

async function mint() {
  if (!tokenName.value.trim() || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const created = await $fetch<{ token: string; name: string }>('/api/account/tokens', {
      method: 'POST',
      headers: headers(),
      body: { name: tokenName.value },
    })
    minted.value = { token: created.token, name: created.name }
    tokenName.value = ''
    analytics.emit('agent-token-minted', { from: 'connect' })
    // The new key's snippet lives in the folded guide — unfold it.
    if (connected.value) setupOpen.value = true
    await refresh()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Could not create the token'
  } finally {
    busy.value = false
  }
}

/** Two-step revoke, no dialog: the first press arms, the second (within 4s) deletes. */
const revokeArmed = ref<string | null>(null)
let revokeTimer: ReturnType<typeof setTimeout> | null = null
async function revoke(id: string) {
  if (revokeArmed.value !== id) {
    revokeArmed.value = id
    if (revokeTimer) clearTimeout(revokeTimer)
    revokeTimer = setTimeout(() => {
      revokeArmed.value = null
    }, 4_000)
    return
  }
  revokeArmed.value = null
  try {
    await $fetch(`/api/account/tokens/${id}`, { method: 'DELETE', headers: headers() })
    await refresh()
  } catch {
    error.value = 'Could not revoke the token'
  }
}

/** The token that appears in the snippets: real once minted, placeholder before. */
const shownToken = computed(() => minted.value?.token ?? 'bck_…mint-a-token-above…')

interface Snippet {
  key: string
  label: string
  language: string
  body: string
  note?: string
}

const snippets = computed<Snippet[]>(() => [
  {
    key: 'claude',
    label: 'Claude Code',
    language: 'bash',
    body: `claude mcp add --transport http blankcode ${mcpUrl.value} \\\n  --header "Authorization: Bearer ${shownToken.value}"`,
  },
  {
    key: 'codex',
    label: 'Codex CLI',
    language: 'toml',
    body: `# ~/.codex/config.toml\n[mcp_servers.blankcode]\nurl = "${mcpUrl.value}"\nhttp_headers = { "Authorization" = "Bearer ${shownToken.value}" }`,
  },
  {
    key: 'universal',
    label: 'Anything that reads mcpServers JSON (pi, crush, omp, qwen…)',
    language: 'json',
    body: JSON.stringify(
      {
        mcpServers: {
          blankcode: {
            type: 'http',
            url: mcpUrl.value,
            headers: { Authorization: `Bearer ${shownToken.value}` },
          },
        },
      },
      null,
      2
    ),
    note: 'The field names vary slightly per harness; the three facts are constant — HTTP transport, this URL, this bearer.',
  },
  {
    key: 'stdio-bridge',
    label: 'Harness cannot send HTTP headers? Bridge over stdio',
    language: 'yaml',
    body: `# any harness that can launch a stdio MCP server (sonar, older CLIs)\n- name: blankcode\n  command: bunx\n  args: ["-y", "mcp-remote", "${mcpUrl.value}",\n         "--header", "Authorization: Bearer ${shownToken.value}"]`,
    note: 'mcp-remote speaks stdio to the harness and streamable HTTP to us, carrying the bearer. Same product, one hop longer.',
  },
])

async function copyText(text: string, key: string) {
  analytics.emit('snippet-copied', { harness: key })
  try {
    await navigator.clipboard.writeText(text)
    copiedKey.value = key
    setTimeout(() => {
      if (copiedKey.value === key) copiedKey.value = null
    }, 2000)
  } catch {
    // Selection by hand still works.
  }
}

/** The one prompt that turns a connected harness into a self-paced course. */
const coursePrompt =
  'Connect to BlankCode. Call whoami, then list_paths and let me pick one. Walk it in order: fetch each exercise, discuss the approach with me before anything is submitted, check work in progress with run_tests (it records nothing), and only call submit_solution when we believe in it. After every verdict, ask me the reflect questions it returns and wait for my answers — if I cannot explain the pass, we redo it together. Never claim a pass the sandbox did not return.'

usePageSeo({
  title: 'Connect your agent — BlankCode',
  description:
    'Practice from your own coding agent. One MCP URL, a scoped practice token, and the same graded sandbox the site uses.',
  path: '/connect',
})
</script>

<template>
  <div class="container max-w-3xl py-10 md:py-14">
    <p class="eyebrow mb-2">bring your own agent</p>
    <h1 class="display text-2xl md:text-3xl mb-4">Practice from your own agent.</h1>
    <p class="mb-2 max-w-xl text-muted-foreground">
      Claude Code, Codex, pi, crush, omp, qwen — anything that speaks MCP can read the exercises,
      submit to the same graded sandbox, and see your progress. The whole product, through one URL:
    </p>
    <code
      class="mb-8 inline-block rounded border border-rule bg-muted/40 px-3 py-1.5 font-mono text-sm"
      >{{ mcpUrl }}</code
    >

    <!-- Connected: the operating view. The guide below folds away. -->
    <Card v-if="connected" class="mb-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="flex items-center gap-2 text-sm font-medium">
            <span
              class="inline-block h-2 w-2 rounded-full"
              :class="liveNow ? 'animate-pulse bg-pass' : 'bg-muted-foreground/40'"
            />
            {{ liveNow ? 'Agent connected — live now' : 'Agent connected' }}
          </p>
          <p v-if="latest" class="mt-1 text-xs text-muted-foreground">
            Last heard from
            <span class="font-medium text-foreground">{{
              latest.clientName ?? 'an unnamed harness'
            }}</span>
            {{ latest.clientVersion ? `v${latest.clientVersion}` : '' }}
            {{ relativeTime(latest.lastSeenAt) }}
            <template v-if="latest.tokenName"> · key “{{ latest.tokenName }}”</template>
          </p>
        </div>
        <dl class="grid grid-cols-2 gap-x-6 gap-y-1 text-right sm:grid-cols-4">
          <div>
            <dt class="eyebrow">calls</dt>
            <dd class="font-mono text-sm">{{ activity!.totals.toolCalls }}</dd>
          </div>
          <div>
            <dt class="eyebrow">sessions</dt>
            <dd class="font-mono text-sm">{{ activity!.totals.sessions }}</dd>
          </div>
          <div>
            <dt class="eyebrow">runs · 24h</dt>
            <dd class="font-mono text-sm">{{ activity!.today.runs }}</dd>
          </div>
          <div>
            <dt class="eyebrow">submits · 24h</dt>
            <dd class="font-mono text-sm">{{ activity!.today.agentSubmissions }}</dd>
          </div>
        </dl>
      </div>

      <ol v-if="activity!.sessions.length" class="mt-4 border border-rule">
        <li
          v-for="(session, i) in activity!.sessions.slice(0, 3)"
          :key="i"
          class="flex items-baseline justify-between gap-3 border-b border-rule px-4 py-2.5 last:border-b-0"
        >
          <span class="min-w-0 flex-1 truncate text-sm">{{
            session.clientName ?? 'unknown harness'
          }}</span>
          <span class="shrink-0 font-mono text-xs text-muted-foreground">
            {{ session.toolCalls }} {{ session.toolCalls === 1 ? 'call' : 'calls' }} ·
            {{ relativeTime(session.lastSeenAt) }}
          </span>
        </li>
      </ol>
      <p class="mt-2 text-xs text-muted-foreground">
        The full ledger lives on your
        <NuxtLink to="/dashboard" class="underline hover:text-foreground">dashboard</NuxtLink> —
        labeled, never merged silently.
      </p>
    </Card>

    <!-- Connected: the keys. One per agent, each nameable and revocable. -->
    <Card v-if="connected" class="mb-6">
      <h2 class="display text-lg mb-1">Your keys</h2>
      <p class="mb-4 max-w-lg text-xs leading-relaxed text-muted-foreground">
        One key per agent keeps the ledger readable — revoking the laptop's key should not log out
        the one at work.
      </p>

      <ol v-if="tokens.length" class="mb-4 border border-rule">
        <li
          v-for="token in tokens"
          :key="token.id"
          class="flex items-center justify-between gap-3 border-b border-rule px-4 py-2.5 last:border-b-0"
        >
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm">{{ token.name }}</p>
            <p class="font-mono text-xs text-muted-foreground">
              {{ token.prefix }}… ·
              {{ token.lastUsedAt ? `last used ${relativeTime(token.lastUsedAt)}` : 'never used' }}
            </p>
          </div>
          <button
            class="shrink-0 font-mono text-xs transition-colors"
            :class="
              revokeArmed === token.id ? 'text-fail' : 'text-muted-foreground hover:text-foreground'
            "
            @click="revoke(token.id)"
          >
            {{ revokeArmed === token.id ? 'press again to revoke' : 'revoke' }}
          </button>
        </li>
      </ol>

      <div v-if="minted" class="mb-4 border-l-2 border-signal bg-signal/5 p-4">
        <p class="mb-1 text-sm font-medium">“{{ minted.name }}” is ready.</p>
        <p class="mb-3 text-xs text-muted-foreground">
          Already filled into the snippets in the setup section below — this is the only time it
          will be shown.
        </p>
        <code
          class="block overflow-x-auto whitespace-nowrap rounded border border-rule bg-background px-3 py-2 font-mono text-xs"
          >{{ minted.token }}</code
        >
      </div>
      <div class="flex items-center gap-2">
        <input
          v-model="tokenName"
          type="text"
          placeholder="Name the next agent's key (e.g. codex at work)"
          class="w-full max-w-sm rounded-lg border border-rule bg-background px-3 py-2 text-sm"
          @keydown.enter="mint"
        />
        <Button size="sm" :disabled="busy || !tokenName.trim()" @click="mint">Mint</Button>
      </div>
      <p v-if="error" class="mt-2 text-xs text-fail">{{ error }}</p>
    </Card>

    <!-- The setup guide: the whole page before the first call, a folded
         reference after it. -->
    <component :is="connected ? 'details' : 'div'" :open="setupOpen || undefined" class="group">
      <summary
        v-if="connected"
        class="mb-6 cursor-pointer list-none rounded border border-rule px-4 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
        @click.prevent="setupOpen = !setupOpen"
      >
        <span class="font-mono text-xs">{{ setupOpen ? '▾' : '▸' }}</span>
        How to connect the next agent — the setup, kept handy
      </summary>

      <!-- Step 1: the key (the tokens card owns this once connected) -->
      <Card v-if="!connected" class="mb-6">
        <h2 class="display text-lg mb-1">1 · Mint a practice token</h2>
        <p class="mb-4 max-w-lg text-xs leading-relaxed text-muted-foreground">
          The key your agent will carry. It can read exercises and submit as you — nothing else: no
          billing, no settings, no minting more keys. Revoke it any time in
          <NuxtLink to="/settings" class="underline hover:text-foreground">Settings</NuxtLink>.
        </p>

        <template v-if="auth.isAuthenticated">
          <div v-if="minted" class="border-l-2 border-signal bg-signal/5 p-4">
            <p class="mb-1 text-sm font-medium">“{{ minted.name }}” is ready.</p>
            <p class="mb-3 text-xs text-muted-foreground">
              It is already filled into the snippets below. This is the only time it will be shown —
              copy the block for your harness now.
            </p>
            <code
              class="block overflow-x-auto whitespace-nowrap rounded border border-rule bg-background px-3 py-2 font-mono text-xs"
              >{{ minted.token }}</code
            >
            <p
              v-if="waitingForFirstCall"
              class="mt-3 flex items-center gap-2 text-xs text-muted-foreground"
            >
              <span class="inline-block h-2 w-2 animate-pulse rounded-full bg-signal" />
              Waiting for its first call — this page notices by itself the moment your agent speaks.
            </p>
          </div>
          <div v-else class="flex items-center gap-2">
            <input
              v-model="tokenName"
              type="text"
              placeholder="Name this key (e.g. claude on my laptop)"
              class="w-full max-w-sm rounded-lg border border-rule bg-background px-3 py-2 text-sm"
              @keydown.enter="mint"
            />
            <Button size="sm" :disabled="busy || !tokenName.trim()" @click="mint">Mint</Button>
          </div>
          <p v-if="error" class="mt-2 text-xs text-fail">{{ error }}</p>
        </template>

        <div v-else class="flex flex-wrap items-center gap-3">
          <NuxtLink to="/login?redirect=/connect"
            ><Button size="sm">Sign in to mint one</Button></NuxtLink
          >
          <p class="text-xs text-muted-foreground">The snippets below show the shape meanwhile.</p>
        </div>
      </Card>

      <!-- Step 2: the snippet -->
      <Card class="mb-6">
        <h2 class="display text-lg mb-1">2 · Point your harness at it</h2>
        <p class="mb-5 max-w-lg text-xs leading-relaxed text-muted-foreground">
          Streamable HTTP, bearer auth, stateless — no OAuth dance, no callback URLs.
        </p>

        <div class="space-y-5">
          <div v-for="snippet in snippets" :key="snippet.key">
            <div class="mb-1.5 flex items-baseline justify-between gap-3">
              <p class="text-sm font-medium">{{ snippet.label }}</p>
              <button
                class="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
                @click="copyText(snippet.body, snippet.key)"
              >
                {{ copiedKey === snippet.key ? 'copied' : 'copy' }}
              </button>
            </div>
            <pre
              class="overflow-x-auto rounded border border-rule bg-muted/40 p-3 font-mono text-xs leading-relaxed"
            ><code>{{ snippet.body }}</code></pre>
            <p v-if="snippet.note" class="mt-1.5 text-xs text-muted-foreground">
              {{ snippet.note }}
            </p>
          </div>
        </div>
      </Card>

      <!-- Step 3: the etiquette -->
      <Card class="mb-6">
        <h2 class="display text-lg mb-1">3 · Teach it the etiquette</h2>
        <p class="mb-4 max-w-lg text-xs leading-relaxed text-muted-foreground">
          A skill file that explains the loop to your agent: confirm whose work it is, never claim a
          pass the sandbox did not grant, and hand recall back to you — an agent pass on a memory
          exercise is recorded as assisted and leaves the review owed. Your schedule models
          <em>your</em> memory; that is the whole product.
        </p>
        <a
          href="/skills/blankcode-practice.md"
          download
          @click="analytics.emit('skill-downloaded', { page: 'connect' })"
        >
          <Button variant="outline" size="sm">Download the skill file</Button>
        </a>
      </Card>

      <!-- Step 4: what it actually looks like -->
      <Card class="mb-6">
        <h2 class="display text-lg mb-1">4 · What a session looks like</h2>
        <p class="mb-4 max-w-lg text-xs leading-relaxed text-muted-foreground">
          Five calls from a real sitting, in order, and exactly what came back — nothing smoothed
          over.
        </p>
        <ol class="border border-rule">
          <li class="border-b border-rule px-4 py-3 last:border-b-0">
            <p class="eyebrow mb-1.5">whoami</p>
            <p class="font-mono text-sm leading-relaxed">→ practicing as you</p>
          </li>
          <li class="border-b border-rule px-4 py-3 last:border-b-0">
            <p class="eyebrow mb-1.5">get_due_reviews</p>
            <p class="font-mono text-sm leading-relaxed">
              → 3 due — these are yours; an agent pass on recall leaves the review owed
            </p>
          </li>
          <li class="border-b border-rule px-4 py-3 last:border-b-0">
            <p class="eyebrow mb-1.5">get_exercise</p>
            <p class="font-mono text-sm leading-relaxed">
              → description, starter code, hints — solution and hidden tests redacted
            </p>
          </li>
          <li class="border-b border-rule px-4 py-3 last:border-b-0">
            <p class="eyebrow mb-1.5">run_tests</p>
            <p class="font-mono text-sm leading-relaxed">
              → 2 of 3 passing — feedback only, nothing recorded · iterate and run again
            </p>
          </li>
          <li class="border-b border-rule px-4 py-3 last:border-b-0">
            <p class="eyebrow mb-1.5">submit_solution</p>
            <p class="font-mono text-sm leading-relaxed">
              → the sandbox's verdict is the only verdict · labeled via agent
            </p>
          </li>
        </ol>
      </Card>

      <!-- Step 5: the prompt that turns it into a course -->
      <Card class="mb-6">
        <h2 class="display text-lg mb-1">5 · Run a course from your agent</h2>
        <p class="mb-4 max-w-lg text-xs leading-relaxed text-muted-foreground">
          Paste this into the harness you just connected. It reads the path, walks it exercise by
          exercise, and stops to talk before anything is submitted.
        </p>
        <div class="mb-1.5 flex items-baseline justify-between gap-3">
          <p class="text-sm font-medium">Prompt</p>
          <button
            class="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
            @click="copyText(coursePrompt, 'course-prompt')"
          >
            {{ copiedKey === 'course-prompt' ? 'copied' : 'copy' }}
          </button>
        </div>
        <pre
          class="overflow-x-auto rounded border border-rule bg-muted/40 p-3 font-mono text-xs leading-relaxed"
        ><code>{{ coursePrompt }}</code></pre>
        <p class="mt-3 text-xs text-muted-foreground">
          Paths and tracks are all walkable this way — the catalogue is the course.
        </p>
      </Card>

      <!-- Step 6: the questions people actually have -->
      <Card>
        <h2 class="display text-lg mb-1">6 · What people ask first</h2>
        <dl class="border border-rule">
          <div class="border-b border-rule px-4 py-3 last:border-b-0">
            <dt class="text-sm">Does agent work move my review schedule?</dt>
            <dd class="mt-1 text-xs text-muted-foreground">
              The vibecoding forms, yes — recall stays owed.
            </dd>
          </div>
          <div class="border-b border-rule px-4 py-3 last:border-b-0">
            <dt class="text-sm">Where do I see agent activity?</dt>
            <dd class="mt-1 text-xs text-muted-foreground">
              Your dashboard, labeled — never merged silently.
            </dd>
          </div>
          <div class="border-b border-rule px-4 py-3 last:border-b-0">
            <dt class="text-sm">Do practice runs spend my submissions?</dt>
            <dd class="mt-1 text-xs text-muted-foreground">
              No. run_tests has its own daily budget on free accounts and records nothing;
              submissions are the verdicts of record.
            </dd>
          </div>
          <div class="border-b border-rule px-4 py-3 last:border-b-0">
            <dt class="text-sm">What can a leaked token do?</dt>
            <dd class="mt-1 text-xs text-muted-foreground">
              Practice as you, nothing else. Revoke it right here — or in Settings.
            </dd>
          </div>
        </dl>
      </Card>
    </component>
  </div>
</template>
