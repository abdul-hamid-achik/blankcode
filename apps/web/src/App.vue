<script setup lang="ts">
import AppHeader from './components/layout/app-header.vue'
import AppFooter from './components/layout/app-footer.vue'
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
