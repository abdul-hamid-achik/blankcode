<script setup lang="ts">
import { usePreferencesStore } from '~/stores/preferences'

const preferencesStore = usePreferencesStore()
const isDark = computed(() => preferencesStore.preferences.theme === 'dark')

useHead({
  htmlAttrs: {
    class: computed(() => (isDark.value ? 'dark' : '')),
  },
})

watch(
  isDark,
  (dark) => {
    if (import.meta.client) {
      if (dark) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
  },
  { immediate: true }
)
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
