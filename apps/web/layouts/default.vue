<script setup lang="ts">
import AppFooter from '~/components/layout/app-footer.vue'
import AppHeader from '~/components/layout/app-header.vue'
import AppSidebar from '~/components/layout/app-sidebar.vue'
import AchievementToast from '~/components/ui/achievement-toast.vue'
import { useAuthStore } from '~/stores/auth'
import { usePreferencesStore } from '~/stores/preferences'

const authStore = useAuthStore()
const preferencesStore = usePreferencesStore()
const route = useRoute()

/**
 * Owned here, not inside either component: the header's hamburger opens it,
 * the sidebar's Escape/overlay/link-click close it, and a route change
 * (following a link, or the back button) always closes it too.
 */
const drawerOpen = ref(false)

/**
 * One button, two meanings by viewport: below lg the hamburger opens the
 * drawer; at lg+ it collapses the persistent sidebar, and that choice is a
 * preference that survives reloads. The owner asked for exactly this —
 * "esconder el sidebar a preferencia y a necesidad".
 */
function toggleNav() {
  if (import.meta.client && window.innerWidth >= 1024) {
    preferencesStore.toggleSidebar()
  } else {
    drawerOpen.value = !drawerOpen.value
  }
}

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
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-background focus:px-3 focus:py-2 focus:font-mono focus:text-sm focus:ring-2 focus:ring-signal"
    >
      Skip to content
    </a>
    <AppHeader :drawer-open="drawerOpen" @toggle-drawer="toggleNav" />
    <div class="flex flex-1">
      <AppSidebar
        v-if="authStore.isAuthenticated"
        :open="drawerOpen"
        :collapsed="preferencesStore.preferences.sidebarCollapsed"
        @close="drawerOpen = false"
      />
      <main id="main-content" tabindex="-1" class="flex-1 min-w-0">
        <slot />
      </main>
    </div>
    <AppFooter />
    <AchievementToast />
  </div>
</template>
