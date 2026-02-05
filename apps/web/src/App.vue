<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import AppFooter from './components/layout/app-footer.vue'
import AppHeader from './components/layout/app-header.vue'

const authStore = useAuthStore()

onMounted(async () => {
  await authStore.initialize()
})
</script>

<template>
  <div class="grid grid-rows-[auto_1fr_auto] min-h-screen bg-background text-foreground">
    <AppHeader />
    <main>
      <RouterView />
    </main>
    <AppFooter />
  </div>
</template>
