<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  icon?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center py-12 text-center">
    <div v-if="icon" class="text-5xl mb-4 opacity-50">{{ icon }}</div>
    <h3 class="text-lg font-medium text-foreground mb-2">{{ title }}</h3>
    <p v-if="description" class="text-sm text-muted-foreground max-w-sm">
      {{ description }}
    </p>
    <div v-if="$slots['action']" class="mt-4">
      <slot name="action" />
    </div>
  </div>
</template>
