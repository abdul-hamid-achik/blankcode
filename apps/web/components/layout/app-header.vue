<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from '~/components/ui/button.vue'
import { useAuthStore } from '~/stores/auth'
import { usePreferencesStore } from '~/stores/preferences'

const authStore = useAuthStore()
const preferencesStore = usePreferencesStore()
const mobileMenuOpen = ref(false)

const isDark = computed(() => preferencesStore.preferences.theme === 'dark')

function toggleDarkMode() {
  preferencesStore.setTheme(isDark.value ? 'light' : 'dark')
}

const navLinks = computed(() => {
  const links = [
    { to: '/tracks', label: 'Tracks' },
    { to: '/tutorials', label: 'Tutorials' },
  ]
  if (authStore.isAuthenticated) {
    links.push({ to: '/progress', label: 'Progress' })
  }
  return links
})

const authLinks = computed(() => {
  if (authStore.isAuthenticated) {
    return [
      { to: '/dashboard', label: 'Dashboard' },
      { to: '/settings', label: 'Settings' },
    ]
  }
  return []
})
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
    <div class="container flex h-16 items-center justify-between">
      <div class="flex items-center gap-8">
        <NuxtLink to="/" class="flex items-center gap-2 font-bold text-xl">
          <span class="text-primary">&lt;/&gt;</span>
          <span>BlankCode</span>
        </NuxtLink>
        <nav class="hidden md:flex items-center gap-6">
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {{ link.label }}
          </NuxtLink>
        </nav>
      </div>
      <div class="hidden md:flex items-center gap-4">
        <button
          class="p-2 text-muted-foreground hover:text-foreground transition-colors"
          @click="toggleDarkMode"
          aria-label="Toggle dark mode"
        >
          <svg v-if="isDark" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <svg v-else class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        </button>
        <template v-if="authStore.isAuthenticated">
          <NuxtLink to="/dashboard">
            <Button variant="ghost" size="sm">Dashboard</Button>
          </NuxtLink>
          <NuxtLink to="/settings">
            <Button variant="ghost" size="sm">Settings</Button>
          </NuxtLink>
          <Button variant="outline" size="sm" @click="authStore.logout">
            Logout
          </Button>
        </template>
        <template v-else>
          <NuxtLink to="/login">
            <Button variant="ghost" size="sm">Login</Button>
          </NuxtLink>
          <NuxtLink to="/register">
            <Button size="sm">Get Started</Button>
          </NuxtLink>
        </template>
      </div>
      <button
        class="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
        @click="mobileMenuOpen = !mobileMenuOpen"
        aria-label="Toggle menu"
      >
        <svg v-if="!mobileMenuOpen" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <svg v-else class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    <nav v-if="mobileMenuOpen" class="md:hidden border-t border-border bg-background px-4 py-3 space-y-1">
      <NuxtLink
        v-for="link in navLinks"
        :key="link.to"
        :to="link.to"
        class="block px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        @click="mobileMenuOpen = false"
      >
        {{ link.label }}
      </NuxtLink>
      <template v-if="authStore.isAuthenticated">
        <NuxtLink
          v-for="link in authLinks"
          :key="link.to"
          :to="link.to"
          class="block px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          @click="mobileMenuOpen = false"
        >
          {{ link.label }}
        </NuxtLink>
        <button
          class="block w-full text-left px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          @click="authStore.logout(); mobileMenuOpen = false"
        >
          Logout
        </button>
      </template>
      <template v-else>
        <NuxtLink
          to="/login"
          class="block px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          @click="mobileMenuOpen = false"
        >
          Login
        </NuxtLink>
        <NuxtLink
          to="/register"
          class="block px-3 py-2 rounded-md text-sm font-medium text-primary hover:text-primary/80 hover:bg-muted transition-colors"
          @click="mobileMenuOpen = false"
        >
          Get Started
        </NuxtLink>
      </template>
    </nav>
  </header>
</template>
