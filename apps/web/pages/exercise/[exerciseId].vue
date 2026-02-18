<script setup lang="ts">
import type { Concept, Track } from '@blankcode/shared'
import CodeEditor from '~/components/editor/code-editor.vue'
import TestResults from '~/components/editor/test-results.vue'
import HintsPanel from '~/components/exercise/hints-panel.vue'
import Button from '~/components/ui/button.vue'
import { useKeyboard } from '~/composables/useKeyboard'
import { useExerciseStore } from '~/stores/exercise'

definePageMeta({ requiresAuth: true, middleware: 'auth' })

interface ExerciseWithRelations {
  concept?: Concept & { track?: Track }
}

const route = useRoute()
const exerciseStore = useExerciseStore()

const exerciseId = computed(() => route.params['exerciseId'] as string)

const language = computed(() => {
  const ex = exerciseStore.exercise as
    | (typeof exerciseStore.exercise & ExerciseWithRelations)
    | null
  const trackSlug: string | undefined = ex?.concept?.track?.slug
  switch (trackSlug) {
    case 'typescript':
      return 'typescript'
    case 'javascript':
      return 'javascript'
    case 'python':
      return 'python'
    case 'rust':
      return 'rust'
    case 'go':
      return 'go'
    case 'vue':
      return 'vue'
    default:
      return 'typescript'
  }
})

const codeSourceLabel = computed(() => {
  switch (exerciseStore.codeSource) {
    case 'draft':
      return 'Restored from draft'
    case 'submission':
      return 'Last submission'
    case 'starter':
      return 'Starter code'
  }
})

onMounted(() => {
  exerciseStore.loadExercise(exerciseId.value)
})

onUnmounted(() => {
  exerciseStore.reset()
})

useKeyboard([
  {
    key: 'Enter',
    ctrl: true,
    handler: () => handleSubmit(),
  },
])

async function handleSubmit() {
  await exerciseStore.submitCode(exerciseStore.currentCode)
}

async function handleRetry() {
  if (exerciseStore.latestSubmission) {
    await exerciseStore.retrySubmission(exerciseStore.latestSubmission.id)
  }
}

function handleCodeUpdate(code: string) {
  exerciseStore.updateCode(code)
}
</script>

<template>
  <div class="min-h-[calc(100vh-8rem)]">
    <div v-if="exerciseStore.loadError" class="container py-12 text-center">
      <p class="text-destructive mb-4">{{ exerciseStore.loadError }}</p>
      <Button @click="exerciseStore.loadExercise(exerciseId)">Retry</Button>
    </div>

    <div v-else-if="!exerciseStore.exercise" class="container py-12 text-center text-muted-foreground">
      Loading exercise...
    </div>

    <div v-else class="h-full flex flex-col lg:flex-row">
      <div class="flex-1 flex flex-col min-w-0">
        <div class="border-b border-border px-6 py-4">
          <h1 class="text-xl font-semibold">{{ exerciseStore.exercise.title }}</h1>
          <p class="text-sm text-muted-foreground mt-1">
            {{ exerciseStore.exercise.description }}
          </p>
          <p class="text-xs text-muted-foreground mt-2">
            {{ codeSourceLabel }}
          </p>
        </div>

        <div class="flex-1 p-6">
          <ClientOnly>
            <CodeEditor
              :code="exerciseStore.currentCode"
              :language="language"
              @update:code="handleCodeUpdate"
              @submit="handleSubmit"
            />
          </ClientOnly>
        </div>

        <div class="border-t border-border px-6 py-4 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-sm text-muted-foreground">
              Press <kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">Ctrl+Enter</kbd> to submit
            </span>
            <span v-if="exerciseStore.isSaving" class="text-xs text-muted-foreground">
              (Saving...)
            </span>
          </div>
          <Button
            :loading="exerciseStore.isSubmitting"
            :disabled="exerciseStore.isSubmitting"
            @click="handleSubmit"
          >
            Run Tests
          </Button>
        </div>
      </div>

      <div class="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-border bg-muted/30 p-6 overflow-y-auto">
        <h2 class="font-semibold mb-4">Results</h2>

        <div v-if="exerciseStore.isSubmitting && !exerciseStore.latestSubmission" class="flex items-center gap-2 text-info text-sm">
          <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>Tests running...</span>
        </div>

        <TestResults
          v-if="exerciseStore.latestSubmission"
          :status="exerciseStore.latestSubmission.status"
          :results="exerciseStore.latestSubmission.testResults"
          :error-message="exerciseStore.latestSubmission.errorMessage"
          :execution-time="exerciseStore.latestSubmission.executionTimeMs"
          :timed-out="exerciseStore.timedOut"
          @retry="handleRetry"
        />

        <div v-else-if="!exerciseStore.isSubmitting" class="text-sm text-muted-foreground">
          Submit your code to see results.
        </div>

        <div v-if="exerciseStore.submissionError" class="mt-4 rounded-md bg-destructive/10 border border-destructive/20 p-3">
          <p class="text-sm text-destructive">{{ exerciseStore.submissionError }}</p>
        </div>

        <div v-if="exerciseStore.exercise.hints?.length" class="mt-6">
          <HintsPanel :hints="exerciseStore.exercise.hints" />
        </div>
      </div>
    </div>
  </div>
</template>
