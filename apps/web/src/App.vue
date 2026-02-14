<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppFooter from './components/layout/app-footer.vue'
import AppHeader from './components/layout/app-header.vue'

const router = useRouter()
const authStore = useAuthStore()

function handleAuthLogout() {
  authStore.logout()
  router.push('/login')
}

onMounted(async () => {
  await authStore.initialize()
  window.addEventListener('auth:logout', handleAuthLogout)
})

onUnmounted(() => {
  window.removeEventListener('auth:logout', handleAuthLogout)
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
