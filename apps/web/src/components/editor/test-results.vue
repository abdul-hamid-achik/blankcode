<script setup lang="ts">
import { computed } from 'vue'
import type { TestResult, SubmissionStatus } from '@blankcode/shared'

interface Props {
  status: SubmissionStatus
  results: TestResult[] | null
  executionTime?: number | null
}

const props = defineProps<Props>()

const statusConfig = computed(() => {
  const configs = {
    pending: { label: 'Pending', color: 'text-muted-foreground', icon: 'clock' },
    running: { label: 'Running', color: 'text-info', icon: 'loader' },
    passed: { label: 'Passed', color: 'text-success', icon: 'check' },
    failed: { label: 'Failed', color: 'text-destructive', icon: 'x' },
    error: { label: 'Error', color: 'text-destructive', icon: 'alert' },
  }
  return configs[props.status]
})

const passedCount = computed(() => props.results?.filter((r) => r.passed).length ?? 0)
const totalCount = computed(() => props.results?.length ?? 0)
</script>

<template>
  <div class="rounded-lg border border-border bg-muted/50 p-4">
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <span :class="['font-medium', statusConfig.color]">
          {{ statusConfig.label }}
        </span>
        <span v-if="results" class="text-sm text-muted-foreground">
          ({{ passedCount }}/{{ totalCount }} tests passed)
        </span>
      </div>
      <span v-if="executionTime" class="text-sm text-muted-foreground">
        {{ executionTime }}ms
      </span>
    </div>

    <div v-if="results" class="space-y-2">
      <div
        v-for="(result, index) in results"
        :key="index"
        class="flex items-start gap-2 text-sm"
      >
        <span :class="result.passed ? 'text-success' : 'text-destructive'">
          {{ result.passed ? '✓' : '✗' }}
        </span>
        <div class="flex-1">
          <div :class="result.passed ? 'text-foreground' : 'text-destructive'">
            {{ result.name }}
          </div>
          <div v-if="result.message" class="text-muted-foreground mt-1">
            {{ result.message }}
          </div>
        </div>
        <span class="text-muted-foreground">{{ result.duration }}ms</span>
      </div>
    </div>

    <div v-else-if="status === 'running'" class="flex items-center gap-2 text-info">
      <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span>Running tests...</span>
    </div>
  </div>
</template>
