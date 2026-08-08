<script setup lang="ts">
import BillingSection from '~/components/billing/billing-section.vue'
import Button from '~/components/ui/button.vue'
import Card from '~/components/ui/card.vue'
import { useAnalytics } from '~/composables/useAnalytics'
import { useAuthStore } from '~/stores/auth'
import { usePreferencesStore } from '~/stores/preferences'
import { AUTH_COOKIE_OPTIONS } from '~/utils/auth-cookie'
import { DEFAULT_EDITOR_THEME, EDITOR_THEMES } from '~/utils/editor-themes'

definePageMeta({ requiresAuth: true, middleware: 'auth' })

const authStore = useAuthStore()
const preferencesStore = usePreferencesStore()

const displayName = ref(authStore.user?.displayName ?? '')

/** Linked sign-in methods, and whether a password exists to fall back on. */
interface IdentityState {
  identities: Array<{ provider: string; email: string | null; createdAt: string }>
  hasPassword: boolean
}

const identityState = ref<IdentityState | null>(null)
const identityBusy = ref(false)
const identityError = ref('')

const oauthProviders = computed(() =>
  (['github', 'google'] as const).map((name) => ({
    name,
    label: name === 'github' ? 'GitHub' : 'Google',
    linkedEmail:
      identityState.value?.identities.find((identity) => identity.provider === name)?.email ??
      (identityState.value?.identities.some((identity) => identity.provider === name)
        ? 'connected'
        : null),
  }))
)

async function loadIdentities() {
  try {
    identityState.value = await $fetch<IdentityState>('/api/account/identities', {
      headers: reminderHeaders(),
    })
  } catch {
    // The section renders as "not connected", which is not a lie so much as
    // the safe reading; connecting again is a no-op for a linked provider.
  }
}

async function unlink(provider: string) {
  identityBusy.value = true
  identityError.value = ''
  try {
    await $fetch('/api/account/identities', {
      method: 'DELETE',
      headers: reminderHeaders(),
      body: { provider },
    })
    await loadIdentities()
  } catch (error) {
    identityError.value =
      (error as { statusMessage?: string })?.statusMessage ?? 'Could not disconnect.'
  } finally {
    identityBusy.value = false
  }
}

/** The reminder toggle. Read once; written on click. */
const remindersEnabled = ref(true)
const remindersLoading = ref(false)

function reminderHeaders(): Record<string, string> {
  const token = useCookie<string | null>('token', AUTH_COOKIE_OPTIONS).value
  return token ? { Authorization: `Bearer ${token}` } : {}
}

onMounted(loadIdentities)

onMounted(async () => {
  try {
    const state = await $fetch<{ enabled: boolean }>('/api/account/reminders', {
      headers: reminderHeaders(),
    })
    remindersEnabled.value = state.enabled
  } catch {
    // The default shown (on) matches the database default, so a failed read
    // does not display a lie.
  }
})

async function toggleReminders() {
  remindersLoading.value = true
  try {
    const state = await $fetch<{ enabled: boolean }>('/api/account/reminders', {
      method: 'POST',
      headers: reminderHeaders(),
      body: { enabled: !remindersEnabled.value },
    })
    remindersEnabled.value = state.enabled
  } finally {
    remindersLoading.value = false
  }
}
const isSaving = ref(false)
const saveMessage = ref('')

async function saveProfile() {
  isSaving.value = true
  saveMessage.value = ''
  try {
    const saved = await $fetch<{ displayName: string | null }>('/api/account/profile', {
      method: 'POST',
      headers: reminderHeaders(),
      body: { displayName: displayName.value },
    })
    // Reflect what the server actually stored (trimmed, bounded), everywhere
    // the name is shown, without waiting for a refetch.
    displayName.value = saved.displayName ?? ''
    if (authStore.user) authStore.user.displayName = saved.displayName
    saveMessage.value = 'Saved.'
  } catch (e) {
    saveMessage.value = e instanceof Error ? e.message : 'Failed to save'
  } finally {
    isSaving.value = false
  }
}

/** Practice tokens: the keys a coding agent carries. */
interface TokenRow {
  id: string
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
}

const tokens = ref<TokenRow[]>([])
const tokenName = ref('')
const tokenBusy = ref(false)
const tokenError = ref('')
/** The one moment the full secret exists in the page. */
const freshToken = ref<{ token: string; name: string } | null>(null)
const copied = ref(false)

async function loadTokens() {
  try {
    const state = await $fetch<{ tokens: TokenRow[] }>('/api/account/tokens', {
      headers: reminderHeaders(),
    })
    tokens.value = state.tokens
  } catch {
    // The section renders empty; creating a token will surface any real error.
  }
}

onMounted(loadTokens)

async function createToken() {
  if (!tokenName.value.trim() || tokenBusy.value) return
  tokenBusy.value = true
  tokenError.value = ''
  try {
    const minted = await $fetch<TokenRow & { token: string }>('/api/account/tokens', {
      method: 'POST',
      headers: reminderHeaders(),
      body: { name: tokenName.value },
    })
    freshToken.value = { token: minted.token, name: minted.name }
    copied.value = false
    useAnalytics().emit('agent-token-minted', { from: 'settings' })
    tokenName.value = ''
    await loadTokens()
  } catch (e) {
    tokenError.value = e instanceof Error ? e.message : 'Could not create the token'
  } finally {
    tokenBusy.value = false
  }
}

async function revokeToken(id: string) {
  if (tokenBusy.value) return
  tokenBusy.value = true
  tokenError.value = ''
  try {
    await $fetch(`/api/account/tokens/${id}`, { method: 'DELETE', headers: reminderHeaders() })
    tokens.value = tokens.value.filter((t) => t.id !== id)
  } catch (e) {
    tokenError.value = e instanceof Error ? e.message : 'Could not revoke the token'
  } finally {
    tokenBusy.value = false
  }
}

async function copyFreshToken() {
  if (!freshToken.value) return
  try {
    await navigator.clipboard.writeText(freshToken.value.token)
    copied.value = true
  } catch {
    // The token is on screen; selecting it by hand still works.
  }
}

function tokenLastUsed(iso: string | null): string {
  if (!iso) return 'never used'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'used today'
  if (days === 1) return 'used yesterday'
  return `used ${days}d ago`
}

/** AI model tier: which one is selected, and whether it's earned honestly. */
interface AiTierOption {
  id: string
  label: string
  blurb: string
  paidOnly: boolean
}

interface AiModelState {
  tier: string
  paid: boolean
  tiers: AiTierOption[]
}

const aiModelState = ref<AiModelState | null>(null)
const aiModelBusy = ref(false)

onMounted(async () => {
  try {
    aiModelState.value = await $fetch<AiModelState>('/api/account/ai-model', {
      headers: reminderHeaders(),
    })
  } catch {
    // The section just does not render; nothing was chosen wrongly.
  }
})

async function selectAiModel(tier: string) {
  if (!aiModelState.value || aiModelBusy.value || aiModelState.value.tier === tier) return
  const previous = aiModelState.value
  aiModelBusy.value = true
  try {
    const saved = await $fetch<{ tier: string }>('/api/account/ai-model', {
      method: 'POST',
      headers: reminderHeaders(),
      body: { tier },
    })
    aiModelState.value = { ...previous, tier: saved.tier }
    useAnalytics().emit('ai-tier-changed', { tier: saved.tier })
  } catch {
    // Selection stays where it was; the click simply did not take.
  } finally {
    aiModelBusy.value = false
  }
}

function increaseFontSize() {
  preferencesStore.setFontSize(preferencesStore.preferences.fontSize + 1)
}

function decreaseFontSize() {
  preferencesStore.setFontSize(preferencesStore.preferences.fontSize - 1)
}

/** Swatches for the editor color theme picker: 'auto' first, then the registry. */
interface EditorThemeSwatch {
  id: string
  label: string
  auto: boolean
  background: string
  foreground: string
}

// 'auto' has no fixed colors of its own — it renders whatever resolveEditorTheme
// would pick for the current site theme, so the swatch never shows a color the
// editor would not actually use.
const AUTO_SWATCH_COLORS = {
  dark: { background: '#282c34', foreground: '#abb2bf' },
  light: { background: 'hsl(210 33% 99%)', foreground: 'hsl(220 28% 10%)' },
} as const

const editorThemeSwatches = computed<EditorThemeSwatch[]>(() => [
  {
    id: DEFAULT_EDITOR_THEME,
    label: 'Auto',
    auto: true,
    ...AUTO_SWATCH_COLORS[preferencesStore.preferences.theme],
  },
  ...Object.entries(EDITOR_THEMES).map(([id, theme]) => ({
    id,
    label: theme.label,
    auto: false,
    background: theme.background,
    foreground: theme.foreground,
  })),
])
</script>

<template>
  <div class="container py-12">
    <div class="max-w-2xl mx-auto">
      <h1 class="display text-2xl md:text-3xl mb-8">Settings</h1>

      <div class="space-y-8">
        <!-- Profile Settings -->
        <Card>
          <h2 class="display text-lg mb-4">Profile</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                :value="authStore.user?.email"
                disabled
                class="w-full px-3 py-2 rounded-lg border border-rule bg-muted text-muted-foreground"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">Username</label>
              <input
                type="text"
                :value="authStore.user?.username"
                disabled
                class="w-full px-3 py-2 rounded-lg border border-rule bg-muted text-muted-foreground"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">Display Name</label>
              <input
                v-model="displayName"
                type="text"
                class="w-full px-3 py-2 rounded-lg border border-rule bg-background"
                placeholder="Enter your display name"
              />
            </div>
            <div class="flex items-center gap-4">
              <Button :loading="isSaving" @click="saveProfile"> Save Changes </Button>
              <span v-if="saveMessage" class="text-sm text-muted-foreground">
                {{ saveMessage }}
              </span>
            </div>
          </div>
        </Card>

        <!-- Plan -->
        <BillingSection />

        <!-- Sign-in methods -->
        <Card>
          <h2 class="display text-lg mb-1">Sign-in methods</h2>
          <p class="text-xs text-muted-foreground leading-relaxed mb-4 max-w-sm">
            Connect GitHub or Google to sign in with them. The last remaining method cannot be
            disconnected — it is how you get back in.
          </p>
          <div class="space-y-3">
            <div
              v-for="provider in oauthProviders"
              :key="provider.name"
              class="flex items-center justify-between gap-4"
            >
              <div>
                <p class="text-sm font-medium">{{ provider.label }}</p>
                <p class="font-mono text-xs text-muted-foreground">
                  {{ provider.linkedEmail ?? 'not connected' }}
                </p>
              </div>
              <Button
                v-if="provider.linkedEmail"
                variant="outline"
                size="sm"
                :disabled="identityBusy"
                @click="unlink(provider.name)"
              >
                Disconnect
              </Button>
              <a v-else :href="`/api/oauth/${provider.name}/start`">
                <Button variant="outline" size="sm">Connect</Button>
              </a>
            </div>
            <p v-if="identityError" class="text-xs text-fail">{{ identityError }}</p>
          </div>
        </Card>

        <!-- Email -->
        <Card>
          <h2 class="display text-lg mb-4">Email</h2>
          <div class="flex items-start justify-between gap-6">
            <div>
              <p class="text-sm font-medium mb-1">Review reminders</p>
              <p class="text-xs text-muted-foreground leading-relaxed max-w-sm">
                One email on days you have exercises due, never more. This is what makes the
                schedule work when you are not thinking about it.
              </p>
            </div>
            <Button
              :variant="remindersEnabled ? 'primary' : 'outline'"
              size="sm"
              :disabled="remindersLoading"
              @click="toggleReminders"
            >
              {{ remindersEnabled ? 'On' : 'Off' }}
            </Button>
          </div>
        </Card>

        <!-- Practice tokens -->
        <Card>
          <h2 class="display text-lg mb-1">Practice tokens</h2>
          <p class="text-xs text-muted-foreground leading-relaxed mb-4 max-w-sm">
            Keys for practicing from your own coding agent. A token can read exercises and submit
            solutions as you — nothing else. Submissions made with one are labeled, and recall
            exercises an agent passes stay owed on your review schedule. Setup lives at
            <NuxtLink to="/connect" class="underline hover:text-foreground">/connect</NuxtLink>.
          </p>

          <!-- The secret, shown exactly once. -->
          <div v-if="freshToken" class="mb-4 border-l-2 border-signal bg-signal/5 p-4">
            <p class="text-sm font-medium mb-1">“{{ freshToken.name }}” is ready.</p>
            <p class="text-xs text-muted-foreground mb-3">
              Copy it now — this is the only time it will be shown.
            </p>
            <code
              class="block overflow-x-auto whitespace-nowrap rounded border border-rule bg-background px-3 py-2 font-mono text-xs"
              >{{ freshToken.token }}</code
            >
            <div class="mt-3 flex gap-2">
              <Button size="sm" @click="copyFreshToken">{{ copied ? 'Copied' : 'Copy' }}</Button>
              <Button variant="outline" size="sm" @click="freshToken = null">Done</Button>
            </div>
          </div>

          <div class="space-y-3">
            <div
              v-for="token in tokens"
              :key="token.id"
              class="flex items-center justify-between gap-4"
            >
              <div class="min-w-0">
                <p class="truncate text-sm font-medium">{{ token.name }}</p>
                <p class="font-mono text-xs text-muted-foreground">
                  {{ token.prefix }}… · {{ tokenLastUsed(token.lastUsedAt) }}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                :disabled="tokenBusy"
                @click="revokeToken(token.id)"
              >
                Revoke
              </Button>
            </div>

            <div class="flex items-center gap-2 pt-1">
              <input
                v-model="tokenName"
                type="text"
                placeholder="Name this key (e.g. laptop)"
                class="w-full max-w-xs rounded-lg border border-rule bg-background px-3 py-2 text-sm"
                @keydown.enter="createToken"
              />
              <Button size="sm" :disabled="tokenBusy || !tokenName.trim()" @click="createToken">
                Create
              </Button>
            </div>
            <p v-if="tokenError" class="text-xs text-fail">{{ tokenError }}</p>
          </div>
        </Card>

        <!-- AI model -->
        <Card v-if="aiModelState">
          <h2 class="display text-lg mb-1">AI model</h2>
          <p class="text-xs text-muted-foreground leading-relaxed mb-4 max-w-sm">
            What reads your code for the failed-test explanation and turn-based hints. Faster tiers
            answer sooner; slower ones read more carefully.
          </p>
          <div class="space-y-3">
            <div
              v-for="tier in aiModelState.tiers"
              :key="tier.id"
              class="flex items-start justify-between gap-4"
            >
              <div>
                <p class="text-sm font-medium">
                  {{ tier.label }}
                  <span v-if="tier.paidOnly" class="ml-1 font-mono text-xs text-muted-foreground"
                    >Pro</span
                  >
                </p>
                <p class="text-xs text-muted-foreground leading-relaxed max-w-sm">
                  {{ tier.blurb }}
                </p>
                <p
                  v-if="
                    tier.id === 'advanced' && aiModelState.tier === 'advanced' && !aiModelState.paid
                  "
                  class="text-xs text-muted-foreground mt-1"
                >
                  resolves to Standard until Pro
                </p>
              </div>
              <Button
                :variant="aiModelState.tier === tier.id ? 'primary' : 'outline'"
                size="sm"
                :disabled="aiModelBusy"
                @click="selectAiModel(tier.id)"
              >
                {{ aiModelState.tier === tier.id ? 'Selected' : 'Choose' }}
              </Button>
            </div>
          </div>
        </Card>

        <!-- Editor Settings -->
        <Card>
          <h2 class="display text-lg mb-4">Editor Preferences</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-2">Theme</label>
              <div class="flex gap-2">
                <Button
                  :variant="preferencesStore.preferences.theme === 'dark' ? 'primary' : 'outline'"
                  size="sm"
                  @click="preferencesStore.setTheme('dark')"
                >
                  Dark
                </Button>
                <Button
                  :variant="preferencesStore.preferences.theme === 'light' ? 'primary' : 'outline'"
                  size="sm"
                  @click="preferencesStore.setTheme('light')"
                >
                  Light
                </Button>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">Editor Theme</label>
              <div class="flex flex-wrap gap-4">
                <button
                  v-for="swatch in editorThemeSwatches"
                  :key="swatch.id"
                  type="button"
                  class="flex w-16 flex-col items-center gap-1.5 text-center"
                  :aria-pressed="preferencesStore.preferences.editorTheme === swatch.id"
                  :aria-label="swatch.label"
                  @click="preferencesStore.setEditorTheme(swatch.id)"
                >
                  <span
                    class="flex h-9 w-14 items-center justify-center rounded-sm border font-mono text-[11px] transition-shadow"
                    :class="
                      preferencesStore.preferences.editorTheme === swatch.id
                        ? 'border-signal ring-2 ring-signal ring-offset-2 ring-offset-background'
                        : 'border-rule'
                    "
                    :style="{ backgroundColor: swatch.background, color: swatch.foreground }"
                    aria-hidden="true"
                  >
                    {{ swatch.auto ? 'auto' : 'Aa' }}
                  </span>
                  <span class="eyebrow">{{ swatch.label }}</span>
                  <span v-if="swatch.auto" class="text-[10px] leading-snug text-muted-foreground">
                    follows the site theme
                  </span>
                </button>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">
                Font Size: {{ preferencesStore.preferences.fontSize }}px
              </label>
              <div class="flex items-center gap-2">
                <Button variant="outline" size="sm" @click="decreaseFontSize"> - </Button>
                <div class="w-12 text-center">{{ preferencesStore.preferences.fontSize }}</div>
                <Button variant="outline" size="sm" @click="increaseFontSize"> + </Button>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">Tab Size</label>
              <div class="flex gap-2">
                <Button
                  v-for="size in [2, 4]"
                  :key="size"
                  :variant="preferencesStore.preferences.tabSize === size ? 'primary' : 'outline'"
                  size="sm"
                  @click="preferencesStore.setTabSize(size)"
                >
                  {{ size }} spaces
                </Button>
              </div>
            </div>

            <div class="flex items-center justify-between">
              <span class="text-sm font-medium">Word Wrap</span>
              <Button
                :variant="preferencesStore.preferences.wordWrap ? 'primary' : 'outline'"
                size="sm"
                @click="preferencesStore.toggleWordWrap"
              >
                {{ preferencesStore.preferences.wordWrap ? 'On' : 'Off' }}
              </Button>
            </div>

            <div class="pt-4 border-t border-rule">
              <Button variant="ghost" size="sm" @click="preferencesStore.reset">
                Reset to Defaults
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>
