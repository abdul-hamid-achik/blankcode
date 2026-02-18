<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  icon?: string
}>()
</script>

<template>
  <div class="rounded-xl border border-border bg-card p-6">
    <div class="flex items-center gap-3">
      <div v-if="icon" class="text-2xl">{{ icon }}</div>
      <div>
        <div class="text-sm text-muted-foreground">{{ label }}</div>
        <div class="text-3xl font-bold mt-1">{{ value }}</div>
      </div>
    </div>
  </div>
</template>
