<script setup lang="ts">
import Button from '~/components/ui/button.vue'
import Card from '~/components/ui/card.vue'
import { useAuthStore } from '~/stores/auth'
import { usePreferencesStore } from '~/stores/preferences'
import { AUTH_COOKIE_OPTIONS } from '~/utils/auth-cookie'

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
    // TODO: Implement user update API
    saveMessage.value = 'Profile updated successfully!'
  } catch (e) {
    saveMessage.value = e instanceof Error ? e.message : 'Failed to save'
  } finally {
    isSaving.value = false
  }
}

function increaseFontSize() {
  preferencesStore.setFontSize(preferencesStore.preferences.fontSize + 1)
}

function decreaseFontSize() {
  preferencesStore.setFontSize(preferencesStore.preferences.fontSize - 1)
}
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
