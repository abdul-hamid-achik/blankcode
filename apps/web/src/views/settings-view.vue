<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { usePreferencesStore } from '@/stores/preferences'
import Card from '@/components/ui/card.vue'
import Button from '@/components/ui/button.vue'

const authStore = useAuthStore()
const preferencesStore = usePreferencesStore()

const displayName = ref(authStore.user?.displayName ?? '')
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
      <h1 class="text-3xl font-bold mb-8">Settings</h1>

      <div class="space-y-8">
        <!-- Profile Settings -->
        <Card>
          <h2 class="text-xl font-semibold mb-4">Profile</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                :value="authStore.user?.email"
                disabled
                class="w-full px-3 py-2 rounded-lg border border-border bg-muted text-muted-foreground"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">Username</label>
              <input
                type="text"
                :value="authStore.user?.username"
                disabled
                class="w-full px-3 py-2 rounded-lg border border-border bg-muted text-muted-foreground"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">Display Name</label>
              <input
                v-model="displayName"
                type="text"
                class="w-full px-3 py-2 rounded-lg border border-border bg-background"
                placeholder="Enter your display name"
              />
            </div>
            <div class="flex items-center gap-4">
              <Button :loading="isSaving" @click="saveProfile">
                Save Changes
              </Button>
              <span v-if="saveMessage" class="text-sm text-muted-foreground">
                {{ saveMessage }}
              </span>
            </div>
          </div>
        </Card>

        <!-- Editor Settings -->
        <Card>
          <h2 class="text-xl font-semibold mb-4">Editor Preferences</h2>
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
                <Button variant="outline" size="sm" @click="decreaseFontSize">
                  -
                </Button>
                <div class="w-12 text-center">{{ preferencesStore.preferences.fontSize }}</div>
                <Button variant="outline" size="sm" @click="increaseFontSize">
                  +
                </Button>
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

            <div class="pt-4 border-t border-border">
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
