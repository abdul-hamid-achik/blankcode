<script setup lang="ts">
import Button from '~/components/ui/button.vue'
</script>

<template>
  <div class="container py-24 text-center">
    <h1 class="text-6xl font-bold text-muted-foreground">404</h1>
    <p class="text-xl text-muted-foreground mt-4">Page not found</p>
    <p class="text-sm text-muted-foreground mt-2">The page you're looking for doesn't exist or has been moved.</p>
    <NuxtLink to="/" class="inline-block mt-8">
      <Button>Back to Home</Button>
    </NuxtLink>
  </div>
</template>
