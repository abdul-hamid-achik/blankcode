<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import CodeEditor from '@/components/editor/code-editor.vue'
import TestResults from '@/components/editor/test-results.vue'
import HintsPanel from '@/components/exercise/hints-panel.vue'
import Button from '@/components/ui/button.vue'
import { useKeyboard } from '@/composables/use-keyboard'
import { useExerciseStore } from '@/stores/exercise'

const route = useRoute()
const exerciseStore = useExerciseStore()

const exerciseId = computed(() => route.params['exerciseId'] as string)

const language = computed(() => {
  // biome-ignore lint/suspicious/noExplicitAny: Exercise type has dynamic nested structure
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

function handleCodeUpdate(code: string) {
  exerciseStore.updateCode(code)
}
</script>

<template>
  <div class="min-h-[calc(100vh-8rem)]">
    <div v-if="!exerciseStore.exercise" class="container py-12 text-center text-muted-foreground">
      Loading exercise...
    </div>

    <div v-else class="h-full flex">
      <div class="flex-1 flex flex-col">
        <div class="border-b border-border px-6 py-4">
          <h1 class="text-xl font-semibold">{{ exerciseStore.exercise.title }}</h1>
          <p class="text-sm text-muted-foreground mt-1">
            {{ exerciseStore.exercise.description }}
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
          <div class="text-sm text-muted-foreground">
            Press <kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">Ctrl+Enter</kbd> to submit
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

        <TestResults
          v-if="exerciseStore.latestSubmission"
          :status="exerciseStore.latestSubmission.status"
          :results="exerciseStore.latestSubmission.testResults"
          :error-message="exerciseStore.latestSubmission.errorMessage"
          :execution-time="exerciseStore.latestSubmission.executionTimeMs"
        />

        <div v-else class="text-sm text-muted-foreground">
          Submit your code to see results.
        </div>

        <div v-if="exerciseStore.exercise.hints?.length" class="mt-6">
          <HintsPanel :hints="exerciseStore.exercise.hints" />
        </div>
      </div>
    </div>
  </div>
</template>
