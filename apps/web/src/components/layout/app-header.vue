<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import Button from '@/components/ui/button.vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const mobileMenuOpen = ref(false)

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
        <RouterLink to="/" class="flex items-center gap-2 font-bold text-xl">
          <span class="text-primary">&lt;/&gt;</span>
          <span>BlankCode</span>
        </RouterLink>
        <nav class="hidden md:flex items-center gap-6">
          <RouterLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {{ link.label }}
          </RouterLink>
        </nav>
      </div>
      <div class="hidden md:flex items-center gap-4">
        <template v-if="authStore.isAuthenticated">
          <RouterLink to="/dashboard">
            <Button variant="ghost" size="sm">Dashboard</Button>
          </RouterLink>
          <RouterLink to="/settings">
            <Button variant="ghost" size="sm">Settings</Button>
          </RouterLink>
          <Button variant="outline" size="sm" @click="authStore.logout">
            Logout
          </Button>
        </template>
        <template v-else>
          <RouterLink to="/login">
            <Button variant="ghost" size="sm">Login</Button>
          </RouterLink>
          <RouterLink to="/register">
            <Button size="sm">Get Started</Button>
          </RouterLink>
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
      <RouterLink
        v-for="link in navLinks"
        :key="link.to"
        :to="link.to"
        class="block px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        @click="mobileMenuOpen = false"
      >
        {{ link.label }}
      </RouterLink>
      <template v-if="authStore.isAuthenticated">
        <RouterLink
          v-for="link in authLinks"
          :key="link.to"
          :to="link.to"
          class="block px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          @click="mobileMenuOpen = false"
        >
          {{ link.label }}
        </RouterLink>
        <button
          class="block w-full text-left px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          @click="authStore.logout(); mobileMenuOpen = false"
        >
          Logout
        </button>
      </template>
      <template v-else>
        <RouterLink
          to="/login"
          class="block px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          @click="mobileMenuOpen = false"
        >
          Login
        </RouterLink>
        <RouterLink
          to="/register"
          class="block px-3 py-2 rounded-md text-sm font-medium text-primary hover:text-primary/80 hover:bg-muted transition-colors"
          @click="mobileMenuOpen = false"
        >
          Get Started
        </RouterLink>
      </template>
    </nav>
  </header>
</template>
