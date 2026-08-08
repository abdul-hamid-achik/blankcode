<script setup lang="ts">
import { computed } from 'vue'

/**
 * The grade, point by point.
 *
 * Missed points are shown in full, with the grader's note. That is the whole
 * pedagogy of this form: the score is a number you can argue with, and the
 * ledger under it is what a complete reading would have noticed. Hiding the
 * misses to protect the second attempt would leave the reader knowing only that
 * they were wrong — which is what they already knew.
 */

interface LedgerResult {
  id: string
  point: string
  weight: number
  hit: boolean
  note: string
}

const props = defineProps<{
  results: LedgerResult[]
  score: number
  maxScore: number
}>()

const full = computed(() => props.maxScore > 0 && props.score === props.maxScore)
const missed = computed(() => props.results.filter((result) => !result.hit))
</script>

<template>
  <section>
    <div class="mb-4 flex items-baseline justify-between gap-4 border-b border-rule-strong pb-3">
      <p class="eyebrow">this reading</p>
      <p class="display text-2xl" :class="full ? 'text-pass' : 'text-foreground'">
        {{ score }}/{{ maxScore }}
      </p>
    </div>

    <p class="mb-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
      <template v-if="full">
        Every point covered. There is nothing left in this codebase you did not say out loud.
      </template>
      <template v-else>
        {{ missed.length }} of {{ results.length }} points went unstated. They are below, in full —
        read them, then read the code again and see where each one was.
      </template>
    </p>

    <ol class="border border-rule">
      <li
        v-for="result in results"
        :key="result.id"
        class="border-b border-rule border-l-2 px-4 py-3 last:border-b-0"
        :class="result.hit ? 'border-l-pass' : 'border-l-fail'"
      >
        <div class="flex items-baseline justify-between gap-4">
          <p class="font-mono text-xs" :class="result.hit ? 'text-pass' : 'text-fail'">
            {{ result.hit ? 'found' : 'missed' }}
          </p>
          <p class="shrink-0 font-mono text-xs text-muted-foreground">
            {{ result.hit ? '+' : '' }}{{ result.hit ? result.weight : 0 }}/{{ result.weight }}
          </p>
        </div>
        <p class="mt-1 text-sm leading-relaxed text-foreground">{{ result.point }}</p>
        <p v-if="result.note" class="mt-1 text-sm leading-relaxed text-muted-foreground">
          {{ result.note }}
        </p>
      </li>
    </ol>
  </section>
</template>
