<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  trackSlug: string
  trackName: string
  totalExercises: number
  completedExercises: number
  masteryLevel: number
}>()

const progressPercent = computed(() =>
  props.totalExercises > 0 ? Math.round((props.completedExercises / props.totalExercises) * 100) : 0
)

/** Mastery arrives 0-1 from the API; show it as a plain percentage. */
const masteryPercent = computed(() => Math.round(props.masteryLevel * 100))
</script>

<template>
  <NuxtLink
    :to="`/tracks/${trackSlug}`"
    class="block bg-background px-4 py-4 transition-colors hover:bg-muted/60"
  >
    <div class="flex items-baseline justify-between gap-4">
      <h3 class="min-w-0 flex-1 truncate display text-base">{{ trackName }}</h3>
      <span class="shrink-0 font-mono text-xs text-muted-foreground">
        {{ completedExercises }}/{{ totalExercises }}
      </span>
    </div>

    <div
      class="mt-3 h-0.5 w-full bg-rule"
      role="img"
      :aria-label="`${progressPercent}% of ${trackName} complete`"
    >
      <div class="h-full bg-signal" :style="{ width: `${progressPercent}%` }" />
    </div>

    <p class="mt-2 font-mono text-xs text-muted-foreground">
      {{ progressPercent }}% done · {{ masteryPercent }}% mastery
    </p>
  </NuxtLink>
</template>
