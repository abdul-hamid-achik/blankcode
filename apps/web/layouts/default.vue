<script setup lang="ts">
import AppFooter from '~/components/layout/app-footer.vue'
import AppHeader from '~/components/layout/app-header.vue'
import AppSidebar from '~/components/layout/app-sidebar.vue'
import AchievementToast from '~/components/ui/achievement-toast.vue'
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()
const route = useRoute()

/**
 * Owned here, not inside either component: the header's hamburger opens it,
 * the sidebar's Escape/overlay/link-click close it, and a route change
 * (following a link, or the back button) always closes it too.
 */
const drawerOpen = ref(false)

onMounted(async () => {
  await authStore.initialize()
})

watch(
  () => route.fullPath,
  () => {
    drawerOpen.value = false
  }
)
</script>

<template>
  <div class="flex flex-col min-h-screen bg-background text-foreground">
    <AppHeader :drawer-open="drawerOpen" @toggle-drawer="drawerOpen = !drawerOpen" />
    <div class="flex flex-1">
      <AppSidebar v-if="authStore.isAuthenticated" :open="drawerOpen" @close="drawerOpen = false" />
      <main class="flex-1 min-w-0">
        <slot />
      </main>
    </div>
    <AppFooter />
    <AchievementToast />
  </div>
</template>
