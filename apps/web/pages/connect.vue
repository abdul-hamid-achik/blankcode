<script setup lang="ts">
import Button from '~/components/ui/button.vue'
import Card from '~/components/ui/card.vue'
import { usePageSeo } from '~/composables/usePageSeo'
import { useAnalytics } from '~/composables/useAnalytics'
import { useAuthStore } from '~/stores/auth'
import { AUTH_COOKIE_OPTIONS } from '~/utils/auth-cookie'

/**
 * The page that IS the bring-your-own-agent feature: mint a key, copy the
 * block for your harness, done. Public so it can be linked and read signed
 * out; minting itself requires the session, which is the security model —
 * the page where you approve a new key is always a page where you are you.
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

function headers(): Record<string, string> {
  const token = useCookie<string | null>('token', AUTH_COOKIE_OPTIONS).value
  return token ? { Authorization: `Bearer ${token}` } : {}
}

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
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Could not create the token'
  } finally {
    busy.value = false
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
  "Connect to BlankCode. Call whoami, then get_progress. Walk me through the 'Working with Models' path: list the exercises, and for each one, fetch it and discuss the approach with me before anything is submitted. Never claim a pass the sandbox did not return."

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

    <!-- Step 1: the key -->
    <Card class="mb-6">
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
        Four calls from a real sitting, in order, and exactly what came back — nothing smoothed
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
          <dt class="text-sm">What can a leaked token do?</dt>
          <dd class="mt-1 text-xs text-muted-foreground">
            Practice as you, nothing else. Revoke it in Settings.
          </dd>
        </div>
      </dl>
    </Card>
  </div>
</template>
