<script setup lang="ts">
/**
 * An empty screen is an invitation to act, so `action` is the point of this
 * component — the title and description only set it up.
 */
defineProps<{
  /** Short mono label, e.g. "no submissions yet". */
  eyebrow?: string
  title: string
  description?: string
}>()
</script>

<template>
  <div class="border border-dashed border-rule-strong px-6 py-12">
    <div class="mx-auto max-w-sm">
      <p v-if="eyebrow" class="eyebrow mb-3">{{ eyebrow }}</p>
      <p class="display text-lg mb-2">{{ title }}</p>
      <p v-if="description" class="text-sm leading-relaxed text-muted-foreground">
        {{ description }}
      </p>
      <div v-if="$slots['action']" class="mt-5">
        <slot name="action" />
      </div>
    </div>
  </div>
</template>
