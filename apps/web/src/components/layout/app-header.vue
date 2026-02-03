<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import Button from '@/components/ui/button.vue'

const authStore = useAuthStore()

const navLinks = [
  { to: '/tracks', label: 'Tracks' },
]
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
      <div class="flex items-center gap-4">
        <template v-if="authStore.isAuthenticated">
          <RouterLink to="/dashboard">
            <Button variant="ghost" size="sm">Dashboard</Button>
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
    </div>
  </header>
</template>
