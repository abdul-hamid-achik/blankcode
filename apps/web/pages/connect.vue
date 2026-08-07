<script setup lang="ts">
import Button from '~/components/ui/button.vue'
import Card from '~/components/ui/card.vue'
import { usePageSeo } from '~/composables/usePageSeo'
import { useAuthStore } from '~/stores/auth'
import { AUTH_COOKIE_OPTIONS } from '~/utils/auth-cookie'

/**
 * The page that IS the bring-your-own-agent feature: mint a key, copy the
 * block for your harness, done. Public so it can be linked and read signed
 * out; minting itself requires the session, which is the security model —
 * the page where you approve a new key is always a page where you are you.
 */

definePageMeta({ requiresAuth: false })

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

async function copySnippet(snippet: Snippet) {
  try {
    await navigator.clipboard.writeText(snippet.body)
    copiedKey.value = snippet.key
    setTimeout(() => {
      if (copiedKey.value === snippet.key) copiedKey.value = null
    }, 2000)
  } catch {
    // Selection by hand still works.
  }
}

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
              @click="copySnippet(snippet)"
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
    <Card>
      <h2 class="display text-lg mb-1">3 · Teach it the etiquette</h2>
      <p class="mb-4 max-w-lg text-xs leading-relaxed text-muted-foreground">
        A skill file that explains the loop to your agent: confirm whose work it is, never claim a
        pass the sandbox did not grant, and hand recall back to you — an agent pass on a memory
        exercise is recorded as assisted and leaves the review owed. Your schedule models
        <em>your</em> memory; that is the whole product.
      </p>
      <a href="/skills/blankcode-practice.md" download>
        <Button variant="outline" size="sm">Download the skill file</Button>
      </a>
    </Card>
  </div>
</template>
