<script setup lang="ts">
const currentYear = new Date().getFullYear()
</script>

<template>
  <footer class="border-t border-rule py-8">
    <div class="container">
      <div class="flex flex-col md:flex-row items-center justify-between gap-4">
        <div class="font-mono text-xs text-muted-foreground">
          {{ currentYear }} &middot; BlankCode
        </div>
        <nav class="flex items-center gap-6">
          <NuxtLink
            to="/privacy"
            class="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Privacy
          </NuxtLink>
          <NuxtLink
            to="/terms"
            class="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Terms
          </NuxtLink>
        </nav>
      </div>
    </div>
  </footer>
</template>
