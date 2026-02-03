<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

const props = defineProps<{
  trackSlug: string
  trackName: string
  totalExercises: number
  completedExercises: number
  masteryLevel: number
}>()

const progressPercent = computed(() =>
  props.totalExercises > 0
    ? Math.round((props.completedExercises / props.totalExercises) * 100)
    : 0
)
</script>

<template>
  <RouterLink :to="`/tracks/${trackSlug}`" class="block">
    <div
      class="rounded-xl border border-border bg-card p-6 hover:border-primary/50 transition-colors cursor-pointer"
    >
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold text-lg">{{ trackName }}</h3>
        <span class="text-sm text-muted-foreground">
          {{ completedExercises }}/{{ totalExercises }}
        </span>
      </div>

      <div class="relative h-2 bg-muted rounded-full overflow-hidden">
        <div
          class="absolute inset-y-0 left-0 bg-primary rounded-full transition-all duration-300"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>

      <div class="mt-2 text-sm text-muted-foreground">
        {{ progressPercent }}% complete
      </div>
    </div>
  </RouterLink>
</template>
