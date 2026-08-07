<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  /** Seven cells, oldest → today. Empty days are the schedule working. */
  strip?: boolean[]
}>()
</script>

<template>
  <div class="bg-background px-4 py-3">
    <p class="eyebrow">{{ label }}</p>
    <p class="display mt-1" :class="strip ? 'text-sm' : 'text-xl'">{{ value }}</p>
    <div v-if="strip" class="mt-2 flex gap-1" aria-hidden="true">
      <span
        v-for="(practiced, i) in strip"
        :key="i"
        class="inline-block h-2 w-5 rounded-sm"
        :class="practiced ? 'bg-signal' : 'border border-rule bg-transparent'"
      />
    </div>
  </div>
</template>
