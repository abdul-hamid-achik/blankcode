<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CodeEditor from '@/components/editor/code-editor.vue'
import TestResults from '@/components/editor/test-results.vue'
import HintsPanel from '@/components/exercise/hints-panel.vue'
import Button from '@/components/ui/button.vue'
import { useKeyboard } from '@/composables/use-keyboard'
import { useAuthStore } from '@/stores/auth'
import { useExerciseStore } from '@/stores/exercise'

const route = useRoute()
const router = useRouter()
const exerciseStore = useExerciseStore()
const authStore = useAuthStore()

const exerciseId = computed(() => route.params['exerciseId'] as string)

const language = computed(() => {
  const trackSlug = (exerciseStore.exercise as any)?.concept?.track?.slug
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

function handleAuthLogout() {
  authStore.logout()
  router.push('/login')
}

onMounted(() => {
  exerciseStore.loadExercise(exerciseId.value)
  window.addEventListener('auth:logout', handleAuthLogout)
})

onUnmounted(() => {
  exerciseStore.reset()
  window.removeEventListener('auth:logout', handleAuthLogout)
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

    <div v-else class="h-full flex">
      <div class="flex-1 flex flex-col">
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
          <CodeEditor
            :code="exerciseStore.currentCode"
            :language="language"
            @update:code="handleCodeUpdate"
            @submit="handleSubmit"
          />
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

      <div class="w-96 border-l border-border bg-muted/30 p-6 overflow-y-auto">
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
