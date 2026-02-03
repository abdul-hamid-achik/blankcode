<script setup lang="ts">
import AppHeader from './components/layout/app-header.vue'
import AppFooter from './components/layout/app-footer.vue'
</script>

<template>
  <div class="min-h-screen flex flex-col bg-background text-foreground">
    <AppHeader />
    <main class="flex-1">
      <RouterView />
    </main>
    <AppFooter />
  </div>
</template>
