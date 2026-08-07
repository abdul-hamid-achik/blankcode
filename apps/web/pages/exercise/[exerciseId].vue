<script setup lang="ts">
import type { Concept, Track } from '@blankcode/shared'
import CodeEditor from '~/components/editor/code-editor.vue'
import TestResults from '~/components/editor/test-results.vue'
import HintsPanel from '~/components/exercise/hints-panel.vue'
import Button from '~/components/ui/button.vue'
import { useKeyboard } from '~/composables/useKeyboard'
import { useExerciseStore } from '~/stores/exercise'
import { useReviewStore } from '~/stores/review'

definePageMeta({ requiresAuth: true, middleware: 'auth' })

interface ExerciseWithRelations {
  concept?: Concept & { track?: Track }
}

const route = useRoute()
const exerciseStore = useExerciseStore()
const reviewStore = useReviewStore()

const exerciseId = computed(() => route.params['exerciseId'] as string)
const ratingSubmittedFor = ref<string | null>(null)
const isRating = ref(false)

const submitShortcutLabel = computed(() => {
  if (!import.meta.client) return 'Ctrl+Enter'
  return /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘↵' : 'Ctrl+↵'
})

const justPassed = computed(() => {
  const sub = exerciseStore.latestSubmission
  return sub?.status === 'passed' && ratingSubmittedFor.value !== sub.id
})

const {
  explanation,
  streaming: explaining,
  error: explainError,
  explain,
  reset: resetExplanation,
} = useExplainFailure()

const justFailed = computed(() => {
  const sub = exerciseStore.latestSubmission
  return sub?.status === 'failed' || sub?.status === 'error'
})

// A new attempt invalidates the previous explanation. Leaving it on screen
// would have it describe code the learner has already changed.
watch(
  () => exerciseStore.latestSubmission?.id,
  () => resetExplanation()
)

function handleExplain() {
  const id = exerciseStore.latestSubmission?.id
  if (id) void explain(id)
}

const concept = computed(
  () =>
    (exerciseStore.exercise as (typeof exerciseStore.exercise & ExerciseWithRelations) | null)
      ?.concept
)

const trackSlug = computed(() => concept.value?.track?.slug)

async function rateRecall(quality: 3 | 4 | 5) {
  const sub = exerciseStore.latestSubmission
  if (!sub || sub.status !== 'passed' || isRating.value) return
  isRating.value = true
  try {
    await reviewStore.completeReview(exerciseId.value, true, quality)
    ratingSubmittedFor.value = sub.id
  } finally {
    isRating.value = false
  }
}

const language = computed(() => {
  switch (trackSlug.value) {
    case 'typescript':
      return 'typescript'
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
      return 'restored draft'
    case 'submission':
      return 'last submission'
    case 'starter':
      return 'starter code'
  }
})

function handleBeforeUnload() {
  exerciseStore.flushDraftOnUnload()
}

onMounted(() => {
  exerciseStore.loadExercise(exerciseId.value)
  if (import.meta.client) {
    window.addEventListener('beforeunload', handleBeforeUnload)
  }
})

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener('beforeunload', handleBeforeUnload)
  }
  // Flush any pending debounced save on route change too.
  exerciseStore.flushDraftOnUnload()
  exerciseStore.reset()
})

useKeyboard([{ key: 'Enter', ctrl: true, handler: () => handleSubmit() }])

async function handleSubmit() {
  if (exerciseStore.isBlankMode) {
    await exerciseStore.submitCode()
  } else {
    await exerciseStore.submitCode(exerciseStore.currentCode)
  }
}

async function handleRetry() {
  if (exerciseStore.latestSubmission) {
    await exerciseStore.retrySubmission(exerciseStore.latestSubmission.id)
  }
}

function handleCodeUpdate(code: string) {
  // In blank mode the document is the read-only starter; the answers live in
  // the widgets. Writing it back would overwrite the reconstructed draft with
  // placeholder text.
  if (exerciseStore.isBlankMode) return
  exerciseStore.updateCode(code)
}

function handleBlankValuesUpdate(values: Map<string, string>) {
  exerciseStore.updateBlankValues(values)
}
</script>

<template>
  <div class="min-h-[calc(100vh-3.5rem)]">
    <!-- Load failure: say what happened, then offer the one useful action. -->
    <div v-if="exerciseStore.loadError" class="container max-w-md py-24">
      <p class="eyebrow mb-4">could not load</p>
      <p class="display mb-3 text-xl">{{ exerciseStore.loadError }}</p>
      <p class="mb-6 text-sm leading-relaxed text-muted-foreground">
        The exercise may not be imported yet, or the API is not responding.
      </p>
      <div class="flex flex-wrap gap-3">
        <Button @click="exerciseStore.loadExercise(exerciseId)">Try again</Button>
        <NuxtLink to="/tracks"><Button variant="outline">Back to tracks</Button></NuxtLink>
      </div>
    </div>

    <div v-else-if="!exerciseStore.exercise" class="container py-16" role="status">
      <p class="eyebrow">loading exercise</p>
      <div class="mt-6 max-w-2xl space-y-3" aria-hidden="true">
        <div class="h-3 w-1/3 animate-pulse rounded bg-muted" />
        <div class="h-3 w-2/3 animate-pulse rounded bg-muted" />
        <div class="mt-8 h-56 animate-pulse rounded border border-rule bg-muted/50" />
      </div>
      <span class="sr-only">Loading exercise…</span>
    </div>

    <div v-else class="flex flex-col lg:h-[calc(100vh-3.5rem)] lg:flex-row">
      <!-- Work surface -->
      <div class="flex min-w-0 flex-1 flex-col">
        <div class="border-b border-rule px-5 py-3 md:px-6">
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
            <NuxtLink
              v-if="trackSlug"
              :to="`/tracks/${trackSlug}`"
              class="eyebrow transition-colors hover:text-foreground"
            >
              {{ trackSlug }}
            </NuxtLink>
            <span v-if="trackSlug && concept?.name" class="eyebrow" aria-hidden="true">/</span>
            <span v-if="concept?.name" class="eyebrow">{{ concept.name }}</span>
            <span v-if="exerciseStore.exercise.difficulty" class="eyebrow ml-auto">
              {{ exerciseStore.exercise.difficulty }}
            </span>
          </div>

          <h1 class="display mt-2 text-lg md:text-xl">{{ exerciseStore.exercise.title }}</h1>
          <p class="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {{ exerciseStore.exercise.description }}
          </p>

          <!--
            The one thing a review has to say before anything else. The editor
            looks the same as any other exercise, and code that reads as
            finished is exactly what stops people from reading it properly.
          -->
          <p
            v-if="exerciseStore.isReviewMode"
            class="mt-3 max-w-2xl border-l-2 border-signal bg-signal/5 py-2 pl-3 text-sm text-foreground"
          >
            <span class="font-medium">This code is wrong.</span>
            Find the defect before you submit — you are graded on tests you cannot see.
          </p>
        </div>

        <div class="min-h-0 flex-1 overflow-auto p-5 md:p-6">
          <ClientOnly>
            <CodeEditor
              :code="exerciseStore.editorCode"
              :language="language"
              :blanks="exerciseStore.blanks"
              :blank-values="exerciseStore.blankValues"
              :blank-feedback="exerciseStore.blankFeedback"
              @update:code="handleCodeUpdate"
              @update:blank-values="handleBlankValuesUpdate"
              @submit="handleSubmit"
            />
          </ClientOnly>
        </div>

        <!-- Action bar: what you need mid-exercise, nothing else. -->
        <div
          class="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-rule bg-background/95 px-5 py-3 backdrop-blur-sm md:px-6"
        >
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs">
            <template v-if="exerciseStore.isBlankMode">
              <span class="text-foreground">
                {{ exerciseStore.filledBlanksCount }}/{{ exerciseStore.blanks.length }} filled
              </span>
              <span class="text-muted-foreground">tab moves · {{ submitShortcutLabel }} runs</span>
            </template>
            <template v-else-if="exerciseStore.isChallengeMode">
              <span class="text-signal">challenge — implement from scratch</span>
              <span class="text-muted-foreground">{{ submitShortcutLabel }} runs</span>
            </template>
            <template v-else>
              <span class="text-muted-foreground">{{ submitShortcutLabel }} runs</span>
            </template>

            <span class="text-muted-foreground">{{ codeSourceLabel }}</span>
            <span v-if="exerciseStore.isSaving" class="text-muted-foreground">saving…</span>
          </div>

          <Button
            :loading="exerciseStore.isSubmitting"
            :disabled="exerciseStore.isSubmitting"
            @click="handleSubmit"
          >
            Run tests
          </Button>
        </div>
      </div>

      <!-- Results rail -->
      <aside
        class="w-full shrink-0 overflow-y-auto border-t border-rule bg-muted/20 p-5 md:p-6 lg:w-[22rem] lg:border-l lg:border-t-0 xl:w-[26rem]"
        aria-label="Results"
      >
        <p class="eyebrow mb-4">results</p>

        <div
          v-if="exerciseStore.isSubmitting && !exerciseStore.latestSubmission"
          class="flex items-center gap-2 font-mono text-sm text-muted-foreground"
          role="status"
        >
          <svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          running tests…
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

        <!--
          Opt-in, and only after a failure. The failed attempt is the retrieval
          the whole product is built on, so being told why has to be a decision
          rather than something that happens to you the moment you are wrong.
        -->
        <div v-if="justFailed" class="mt-4">
          <Button
            v-if="!explanation && !explaining"
            variant="ghost"
            size="sm"
            @click="handleExplain"
          >
            Explain why this failed
          </Button>

          <p v-if="explaining && !explanation" class="text-sm text-muted-foreground">thinking…</p>

          <div
            v-if="explanation"
            class="border-l-2 border-rule-strong pl-4 text-sm text-muted-foreground whitespace-pre-wrap"
          >
            {{ explanation }}
          </div>

          <p v-if="explainError" class="text-sm text-fail">{{ explainError }}</p>
        </div>

        <!-- The recall rating sets the schedule. It earns its own block. -->
        <div
          v-if="justPassed"
          class="mt-5 border-l-2 border-signal bg-signal/5 p-4"
          role="group"
          aria-label="Rate your recall"
        >
          <p class="display mb-1 text-sm">How did that come back?</p>
          <p class="mb-4 text-xs leading-relaxed text-muted-foreground">
            Your answer sets when you see this again. Be honest — guessing right still counts as
            hard.
          </p>
          <div class="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" :disabled="isRating" @click="rateRecall(3)">
              Hard
            </Button>
            <Button variant="outline" size="sm" :disabled="isRating" @click="rateRecall(4)">
              Good
            </Button>
            <Button variant="outline" size="sm" :disabled="isRating" @click="rateRecall(5)">
              Easy
            </Button>
          </div>
        </div>

        <p
          v-else-if="
            exerciseStore.latestSubmission?.status === 'passed' &&
            ratingSubmittedFor === exerciseStore.latestSubmission.id
          "
          class="mt-5 font-mono text-xs text-pass"
        >
          rating saved — scheduled forward
        </p>

        <p
          v-else-if="!exerciseStore.latestSubmission && !exerciseStore.isSubmitting"
          class="font-mono text-sm text-muted-foreground"
        >
          Nothing run yet.
        </p>

        <div
          v-if="exerciseStore.submissionError"
          class="mt-5 border-l-2 border-fail bg-fail/5 p-4 text-sm text-fail"
          role="alert"
        >
          {{ exerciseStore.submissionError }}
        </div>

        <div v-if="exerciseStore.exercise.hints?.length" class="mt-8 border-t border-rule pt-6">
          <HintsPanel :hints="exerciseStore.exercise.hints" />
        </div>
      </aside>
    </div>
  </div>
</template>
