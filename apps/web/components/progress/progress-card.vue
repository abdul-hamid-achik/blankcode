<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
}>()
</script>

<template>
  <div class="bg-background px-4 py-3">
    <p class="eyebrow">{{ label }}</p>
    <p class="display mt-1 text-xl">{{ value }}</p>
  </div>
</template>
