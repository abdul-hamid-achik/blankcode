<script setup lang="ts">
import AppFooter from '~/components/layout/app-footer.vue'
import AppHeader from '~/components/layout/app-header.vue'
import AchievementToast from '~/components/ui/achievement-toast.vue'
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()

onMounted(async () => {
  await authStore.initialize()
})
</script>

<template>
  <div class="flex flex-col min-h-screen bg-background text-foreground">
    <AppHeader />
    <main class="flex-1">
      <slot />
    </main>
    <AppFooter />
    <AchievementToast />
  </div>
</template>
