<script setup lang="ts">
const currentYear = new Date().getFullYear()
</script>

<template>
  <footer class="border-t border-border bg-muted/30 py-8">
    <div class="container">
      <div class="flex flex-col md:flex-row items-center justify-between gap-4">
        <div class="text-sm text-muted-foreground">
          {{ currentYear }} BlankCode. Practice code completion.
        </div>
        <nav class="flex items-center gap-6">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            class="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            GitHub
          </a>
          <a
            href="#"
            class="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Privacy
          </a>
          <a
            href="#"
            class="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Terms
          </a>
        </nav>
      </div>
    </div>
  </footer>
</template>
