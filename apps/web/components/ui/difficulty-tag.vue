<script setup lang="ts">
import { computed } from 'vue'

/**
 * One difficulty treatment for the whole app.
 *
 * The colour map used to be copy-pasted into challenges, paths, and the
 * exercise page, each with its own rainbow of greens and reds that competed
 * with the signal colour. Difficulty is ordinal, so show it as a rank on the
 * rule instead of as a hue.
 */

const props = defineProps<{
  difficulty: string
  /** Renders the four-step rank meter beside the label. */
  showRank?: boolean
}>()

const ORDER = ['beginner', 'intermediate', 'advanced', 'expert']

const rank = computed(() => ORDER.indexOf(props.difficulty.toLowerCase()) + 1)
</script>

<template>
  <span class="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider">
    <span
      v-if="showRank && rank > 0"
      class="inline-flex gap-0.5"
      :aria-label="`difficulty ${rank} of 4`"
    >
      <span
        v-for="step in 4"
        :key="step"
        class="h-2.5 w-0.5"
        :class="step <= rank ? 'bg-signal' : 'bg-rule-strong'"
      />
    </span>
    <span class="text-muted-foreground">{{ difficulty }}</span>
  </span>
</template>
