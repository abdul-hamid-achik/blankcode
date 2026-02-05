<script setup lang="ts">
import type { SubmissionStatus, TestResult } from '@blankcode/shared'
import { computed } from 'vue'
import Button from '@/components/ui/button.vue'
import { getStatusClasses } from '@/utils/submission-status'

interface Props {
  status: SubmissionStatus
  results: TestResult[] | null
  errorMessage?: string | null
  executionTime?: number | null
  timedOut?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  retry: []
}>()

const statusConfig = computed(() => getStatusClasses(props.status))

const passedCount = computed(() => props.results?.filter((r) => r.passed).length ?? 0)
const totalCount = computed(() => props.results?.length ?? 0)

function formatMessage(message: string): string {
  const lines = message.split('\n')
  const relevantLines = lines.filter(
    (line) =>
      !line.includes('node_modules/vitest') &&
      !line.includes('node_modules/@vitest') &&
      !line.includes('node_modules/pytest') &&
      line.trim()
  )
  const truncated = relevantLines.slice(0, 10).join('\n')
  return truncated || message.slice(0, 400)
}
</script>

<template>
  <div class="rounded-lg border border-border bg-muted/50 p-4">
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <span :class="['font-medium', statusConfig.colorClass]">
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

    <div v-if="results && results.length > 0" class="space-y-3">
      <div
        v-for="(result, index) in results"
        :key="index"
        class="text-sm"
      >
        <div class="flex items-center gap-2">
          <span :class="result.passed ? 'text-success' : 'text-destructive'" class="flex-shrink-0">
            {{ result.passed ? '✓' : '✗' }}
          </span>
          <span :class="result.passed ? 'text-foreground' : 'text-destructive'" class="flex-1 truncate">
            {{ result.name }}
          </span>
          <span v-if="result.duration != null" class="text-muted-foreground flex-shrink-0">{{ result.duration.toFixed(1) }}ms</span>
        </div>
        <div v-if="result.message && !result.passed" class="mt-1 ml-5">
          <pre class="text-xs text-muted-foreground bg-muted p-2 rounded overflow-x-auto max-h-40 whitespace-pre-wrap break-words">{{ formatMessage(result.message) }}</pre>
        </div>
      </div>
    </div>

    <div v-else-if="status === 'running'" class="flex items-center gap-2 text-info">
      <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span>Running tests...</span>
    </div>

    <div v-else-if="timedOut" class="space-y-3">
      <div class="flex items-center gap-2 text-warning">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span class="font-medium">Submission timed out</span>
      </div>
      <Button size="sm" @click="$emit('retry')">Retry</Button>
    </div>

    <div v-else-if="status === 'pending'" class="flex items-center gap-2 text-muted-foreground">
      <svg class="h-4 w-4 animate-pulse" viewBox="0 0 24 24" fill="none">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      </svg>
      <span>Queued for execution...</span>
    </div>

    <div v-else-if="status === 'error'" class="space-y-2">
      <div class="text-sm text-destructive font-medium">Execution Error</div>
      <pre v-if="errorMessage" class="text-xs bg-destructive/10 text-destructive p-3 rounded-md overflow-x-auto max-h-40 whitespace-pre-wrap break-words">{{ formatMessage(errorMessage) }}</pre>
      <p v-else class="text-sm text-muted-foreground">An error occurred while running your code.</p>
    </div>
  </div>
</template>
