<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from '~/components/ui/button.vue'

const props = defineProps<{
  hints: string[]
  /** Slug, for the counter that shows which exercises need clearer hints. */
  exercise?: string
}>()

const revealedCount = ref(0)

const visibleHints = computed(() => props.hints.slice(0, revealedCount.value))

const hasMoreHints = computed(() => revealedCount.value < props.hints.length)

const remainingHints = computed(() => props.hints.length - revealedCount.value)

const analytics = useAnalytics()

function revealNext() {
  // High counts on one exercise mean the exercise is unclear, not the people.
  if (props.exercise) {
    analytics.emit('hint-revealed', { exercise: props.exercise, index: revealedCount.value })
  }
  if (hasMoreHints.value) {
    revealedCount.value++
  }
}

function reset() {
  revealedCount.value = 0
}

defineExpose({ reset })
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="font-semibold">Hints</h3>
      <span v-if="hints.length > 0" class="text-xs text-muted-foreground">
        {{ revealedCount }}/{{ hints.length }} revealed
      </span>
    </div>

    <div v-if="visibleHints.length > 0" class="space-y-3">
      <div
        v-for="(hint, index) in visibleHints"
        :key="index"
        class="p-3 rounded-lg bg-muted/50 border border-rule text-sm animate-in fade-in slide-in-from-top-2"
      >
        <span class="text-muted-foreground mr-2">{{ index + 1 }}.</span>
        {{ hint }}
      </div>
    </div>

    <div v-else-if="hints.length > 0" class="text-sm text-muted-foreground">
      Need help? Reveal a hint below.
    </div>

    <div v-else class="text-sm text-muted-foreground">No hints available for this exercise.</div>

    <Button v-if="hasMoreHints" variant="outline" size="sm" class="w-full" @click="revealNext">
      Reveal Hint ({{ remainingHints }} remaining)
    </Button>
  </div>
</template>
