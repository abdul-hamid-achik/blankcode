<script setup lang="ts">
import type { Concept, Track } from '@blankcode/shared'
import CodeEditor from '~/components/editor/code-editor.vue'
import TestResults from '~/components/editor/test-results.vue'
import HintsPanel from '~/components/exercise/hints-panel.vue'
import TaskBriefPanel from '~/components/exercise/task-brief-panel.vue'
import ContextSessionView from '~/components/exercise/context-session-view.vue'
import AgentSessionView from '~/components/exercise/agent-session-view.vue'
import TurnSessionView from '~/components/exercise/turn-session-view.vue'
import Button from '~/components/ui/button.vue'
import { useKeyboard } from '~/composables/useKeyboard'
import { useExerciseStore } from '~/stores/exercise'
import { useReviewStore } from '~/stores/review'
import { AUTH_COOKIE_OPTIONS } from '~/utils/auth-cookie'
import {
  defaultReflectQuestion,
  isSubstantiveReflection,
  MIN_SUBSTANTIVE_REFLECTION_CHARS,
} from '~/utils/reflection'
import {
  continueChrome,
  shouldNoteSittingPass,
  shouldShowTrackFinished,
  type ContinueKind,
} from '~/utils/continue-target'
import { speakSchedule } from '~/utils/review-dates'
import { practiceQuotaLine, type PracticeQuota } from '~/utils/quota-line'
import { runShortcutLabel, submitShortcutLabel as shortcutLabel } from '~/utils/submit-shortcut'
import { useAuthStore } from '~/stores/auth'

const props = defineProps<{ exerciseId: string }>()

interface ExerciseWithRelations {
  concept?: Concept & { track?: Track }
}

interface ReflectionRow {
  id: string
  question: string
  answer: string
  createdAt: string
}

const exerciseStore = useExerciseStore()
const reviewStore = useReviewStore()
const authStore = useAuthStore()
const api = useApi()

const exerciseId = computed(() => props.exerciseId)

const signInHref = computed(
  () => `/login?redirect=${encodeURIComponent(`/exercise/${exerciseId.value}`)}`
)

useSeoMeta({
  title: () => exerciseStore.exercise?.title ?? 'Exercise',
  description: () => exerciseStore.exercise?.description ?? 'A BlankCode exercise.',
})

/**
 * What the learner said when asked to explain this exercise — recorded
 * verbatim over MCP or from the form below. The page holds both halves of
 * the record: the sandbox's verdict and the human's understanding.
 */
const reflections = ref<ReflectionRow[]>([])
/**
 * True while an agent pass left this exercise's review held a day out.
 * Cleared when a substantive answer lands (or the human redoes the exercise
 * and the schedule settles elsewhere).
 */
const awaitingExplanation = ref(false)
const holdAnswer = ref('')
const holdBusy = ref(false)
const holdError = ref('')
const holdFeedback = ref<'released' | 'hollow' | null>(null)

const holdQuestion = computed(() => defaultReflectQuestion(exerciseStore.exercise?.type))

async function loadReflectionState() {
  const [listed, unexplained] = await Promise.all([
    api.reflections.getByExercise(exerciseId.value).catch(() => [] as ReflectionRow[]),
    api.reviews.getUnexplained().catch(() => [] as Array<{ exerciseId: string }>),
  ])
  reflections.value = listed
  awaitingExplanation.value = unexplained.some((row) => row.exerciseId === exerciseId.value)
}

async function submitHoldExplanation() {
  const answer = holdAnswer.value.trim()
  const question = holdQuestion.value
  if (!answer || holdBusy.value) return

  holdBusy.value = true
  holdError.value = ''
  holdFeedback.value = null
  try {
    const row = await api.reflections.create({
      exerciseId: exerciseId.value,
      question,
      answer,
    })
    reflections.value = [
      {
        id: row.id,
        question: row.question,
        answer: row.answer,
        createdAt: row.createdAt,
      },
      ...reflections.value,
    ]
    holdAnswer.value = ''

    if (isSubstantiveReflection(answer)) {
      // Server promotes heldNextReviewAt; we drop the form without another
      // round-trip so the page matches the schedule immediately.
      awaitingExplanation.value = false
      holdFeedback.value = 'released'
      // Due badge may drop one if this was the only held item due soon.
      void reviewStore.loadDueCount()
    } else {
      holdFeedback.value = 'hollow'
    }
  } catch (caught) {
    holdError.value =
      caught instanceof Error ? caught.message : 'Could not record the explanation. Try again.'
  } finally {
    holdBusy.value = false
  }
}

onMounted(() => {
  if (authStore.isAuthenticated) void loadReflectionState()
})
const ratingSubmittedFor = ref<string | null>(null)
const isRating = ref(false)

const submitShortcutLabel = computed(() =>
  shortcutLabel(import.meta.client ? navigator.platform : '')
)
const runShortcutText = computed(() =>
  runShortcutLabel(import.meta.client ? navigator.platform : '')
)

const quota = ref<PracticeQuota | null>(null)
const quotaLine = computed(() => (quota.value ? practiceQuotaLine(quota.value) : null))

async function loadQuota() {
  try {
    quota.value = await $fetch<PracticeQuota>('/api/account/quota', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  } catch {
    quota.value = null
  }
}

const token = useCookie<string | null>('token', AUTH_COOKIE_OPTIONS).value

const justPassed = computed(() => {
  const sub = exerciseStore.latestSubmission
  return (
    shouldNoteSittingPass({
      status: sub?.status,
      submissionId: sub?.id,
      sittingSubmissionIds: new Set(exerciseStore.sittingSubmissionIds),
    }) &&
    !!sub &&
    ratingSubmittedFor.value !== sub.id
  )
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
  // A visible practice run supersedes the submission on screen; offering to
  // explain a submission the learner is already iterating past reads stale.
  if (exerciseStore.latestRun || exerciseStore.isRunning) return false
  return sub?.status === 'failed' || sub?.status === 'error'
})

// A new attempt invalidates the previous explanation. Leaving it on screen
// would have it describe code the learner has already changed.
watch(
  () => exerciseStore.latestSubmission?.id,
  () => resetExplanation()
)

/*
 * Fetch "what comes next" on the pass itself, not inside the rating handler.
 * Rating is optional — someone who passes and skips the rating used to get
 * no onward path at all, because the only call site was rateRecall.
 */
watch(
  () => exerciseStore.latestSubmission,
  (submission) => {
    if (submission?.status !== 'passed') return
    if (
      shouldNoteSittingPass({
        status: submission.status,
        submissionId: submission.id,
        sittingSubmissionIds: new Set(exerciseStore.sittingSubmissionIds),
      })
    ) {
      reviewStore.notePassedInSession(exerciseId.value)
    }
    void loadWhatsNext()
    void loadConceptTutorial()
    void checkAchievements()
  }
)

/**
 * Award at the earning moment. The award check used to run only when
 * someone happened to visit the achievements page — and the toast that
 * layouts mount everywhere had no caller at all, so earning one was
 * silent. The pass is the event; this is its handler.
 */
const { showAchievementUnlocked } = useAchievementNotifications()

async function checkAchievements() {
  try {
    const api = useApi()
    const mine = await api.achievements.getMine()
    for (const achievement of mine) {
      const a = achievement as {
        isNew?: boolean
        title?: string
        description?: string
        icon?: string
        color?: string
      }
      if (a.isNew && a.title) {
        showAchievementUnlocked({
          title: a.title,
          description: a.description ?? '',
          icon: a.icon ?? '·',
          color: a.color ?? 'var(--signal)',
        })
      }
    }
  } catch {
    // Missing a toast costs nothing; the achievements page still shows it.
  }
}

/**
 * The tutorial behind this concept, when one exists — the other half of the
 * tutorial↔exercise thread. Tutorials end in "practice this"; the report
 * after practicing points back at the reading.
 */
const conceptTutorial = ref<{ path: string; title: string } | null>(null)
let tutorialLookupDone = false

async function loadConceptTutorial() {
  const conceptSlug = (concept.value as { slug?: string } | undefined)?.slug
  const track = trackSlug.value
  if (!conceptSlug || !track || tutorialLookupDone) return
  tutorialLookupDone = true
  try {
    const candidates = await queryCollection('tutorials').where('track', '=', track).all()
    const hit = candidates.find(
      (tutorial) =>
        (tutorial as { practice?: { concept?: string } }).practice?.concept === conceptSlug
    )
    if (hit) conceptTutorial.value = { path: hit.path, title: hit.title }
  } catch {
    // A missing tutorial link costs nothing; the report stands without it.
  }
}

const analytics = useAnalytics()

function handleExplain() {
  const id = exerciseStore.latestSubmission?.id
  if (id) {
    analytics.emit('explanation-requested', { track: trackSlug.value ?? 'unknown' })
    void explain(id)
  }
}

const concept = computed(
  () =>
    (exerciseStore.exercise as (typeof exerciseStore.exercise & ExerciseWithRelations) | null)
      ?.concept
)

/**
 * The session forms are graded conversations, not files to edit — each
 * dispatches to its own surface (TurnSessionView, ContextSessionView)
 * instead of the editor, which could not keep their promises.
 */
const sessionForm = computed(() => {
  const type = exerciseStore.exercise?.type
  return type === 'turn' || type === 'context' || type === 'agent' ? type : null
})

const trackSlug = computed(() => concept.value?.track?.slug)

interface WhatsNext {
  kind?: ContinueKind
  next: {
    id: string
    slug: string
    title: string
    difficulty: string
    conceptName: string
    sameConcept: boolean
  } | null
  track: { slug: string; name: string }
}

/**
 * Fetched only once someone has passed, not on load.
 *
 * Most visits to this page do not end in a pass, and asking the server what
 * comes next before there is anything to come next from is a query per page
 * view for a button most people never see.
 */
const whatsNext = ref<WhatsNext | null>(null)
const nextKind = computed<ContinueKind>(() => whatsNext.value?.kind ?? 'new-material')

async function loadWhatsNext() {
  if (whatsNext.value) return
  try {
    // The same cookie `useApi` reads. This route is a Nitro handler rather than
    // part of the Effect API, so it is not behind that client.
    const token = useCookie<string | null>('token', AUTH_COOKIE_OPTIONS).value
    whatsNext.value = await $fetch<WhatsNext>(`/api/exercises/${exerciseId.value}/next`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  } catch (error) {
    // A missing "next" is not worth an error state: the links below it still
    // get someone out of the page.
    console.error('[exercise] could not load what comes next:', String(error))
  }
}

/**
 * The date the rating just set. "Scheduled forward" was true and useless —
 * the scheduler's entire output is a date, and saying it is what makes the
 * machinery visible: rate Easy and watch it answer with a longer one.
 */
const scheduledPhrase = ref<string | null>(null)

async function rateRecall(quality: 3 | 4 | 5) {
  const sub = exerciseStore.latestSubmission
  if (!sub || sub.status !== 'passed' || isRating.value) return
  isRating.value = true
  try {
    const schedule = await reviewStore.completeReview(exerciseId.value, true, quality)
    scheduledPhrase.value = schedule ? speakSchedule(schedule.nextReviewAt) : null
    ratingSubmittedFor.value = sub.id
    await loadWhatsNext()
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

watch(exerciseId, (id, previous) => {
  if (!previous || previous === id) return
  exerciseStore.flushDraftOnUnload()
  exerciseStore.reset()
  whatsNext.value = null
  ratingSubmittedFor.value = null
  scheduledPhrase.value = null
  conceptTutorial.value = null
  tutorialLookupDone = false
  reflections.value = []
  awaitingExplanation.value = false
  holdAnswer.value = ''
  holdError.value = ''
  holdFeedback.value = null
  void exerciseStore.loadExercise(id)
  void loadReflectionState()
})

onMounted(() => {
  exerciseStore.loadExercise(exerciseId.value)
  void loadQuota()
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

useKeyboard([
  { key: 'Enter', ctrl: true, shift: true, handler: () => handleRun() },
  { key: 'Enter', ctrl: true, handler: () => handleSubmit() },
])

async function handleSubmit() {
  if (!authStore.isAuthenticated) return
  if (exerciseStore.isBlankMode) {
    await exerciseStore.submitCode()
  } else {
    await exerciseStore.submitCode(exerciseStore.currentCode)
  }
  if (!exerciseStore.submissionError && quota.value && quota.value.submissionsRemaining !== null) {
    quota.value = {
      ...quota.value,
      submissionsRemaining: Math.max(0, quota.value.submissionsRemaining - 1),
    }
  }
}

async function handleRun() {
  if (!authStore.isAuthenticated) return
  if (exerciseStore.isBlankMode) {
    await exerciseStore.runCode()
  } else {
    await exerciseStore.runCode(exerciseStore.currentCode)
  }
  const remaining = exerciseStore.latestRun?.runsRemainingToday
  if (quota.value && remaining !== undefined && remaining !== null) {
    quota.value = { ...quota.value, runsRemaining: remaining }
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
          <p
            v-if="sessionForm"
            class="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground"
          >
            {{ exerciseStore.exercise.description }}
          </p>
          <TaskBriefPanel
            v-else
            :type="exerciseStore.exercise.type"
            :description="exerciseStore.exercise.description"
            :slug="exerciseStore.exercise.slug"
          />
        </div>

        <!-- Form C is live; the context form still gates until its surface exists. -->
        <div
          v-if="sessionForm && !authStore.isAuthenticated"
          class="border-t border-rule px-5 py-10 md:px-6"
        >
          <p class="mb-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
            This one is a graded conversation, not a file. Sign in to start the sitting — the brief
            above is the whole prompt.
          </p>
          <Button :to="signInHref">Sign in to start</Button>
        </div>

        <TurnSessionView
          v-else-if="sessionForm === 'turn'"
          :exercise="{
            id: exerciseStore.exercise.id,
            title: exerciseStore.exercise.title,
            description: exerciseStore.exercise.description,
            starterCode: exerciseStore.exercise.starterCode,
            turnBudget: (exerciseStore.exercise as { turnBudget?: number | null }).turnBudget,
          }"
          :language="language"
        />

        <ContextSessionView
          v-else-if="sessionForm === 'context'"
          :exercise="{
            id: exerciseStore.exercise.id,
            title: exerciseStore.exercise.title,
            description: exerciseStore.exercise.description,
          }"
        />

        <AgentSessionView
          v-else-if="sessionForm === 'agent'"
          :exercise="{
            id: exerciseStore.exercise.id,
            title: exerciseStore.exercise.title,
            description: exerciseStore.exercise.description,
          }"
          :language="language"
          :concept-slug="concept?.slug ?? ''"
        />

        <div v-else class="min-h-0 flex-1 overflow-auto p-5 md:p-6">
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
          v-if="!sessionForm"
          class="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-rule bg-background/95 px-5 py-3 backdrop-blur-sm md:px-6"
        >
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs">
            <template v-if="exerciseStore.isBlankMode">
              <span class="text-foreground">
                {{ exerciseStore.filledBlanksCount }}/{{ exerciseStore.blanks.length }} filled
              </span>
              <span class="text-muted-foreground"
                >tab moves · {{ submitShortcutLabel }} submits · {{ runShortcutText }} runs</span
              >
            </template>
            <template v-else-if="exerciseStore.isChallengeMode">
              <span class="text-signal">challenge — implement from scratch</span>
              <span class="text-muted-foreground"
                >{{ submitShortcutLabel }} submits · {{ runShortcutText }} runs</span
              >
            </template>
            <template v-else-if="exerciseStore.isReviewMode">
              <span class="text-signal">review — find the defect</span>
              <span class="text-muted-foreground"
                >{{ submitShortcutLabel }} submits · {{ runShortcutText }} runs</span
              >
            </template>
            <template v-else>
              <span class="text-muted-foreground"
                >{{ submitShortcutLabel }} submits · {{ runShortcutText }} runs</span
              >
            </template>

            <span class="text-muted-foreground">{{ codeSourceLabel }}</span>
            <span v-if="quotaLine" class="text-muted-foreground">{{ quotaLine }}</span>
            <span v-if="exerciseStore.isSaving" class="text-muted-foreground">saving…</span>
          </div>

          <div class="flex items-center gap-2">
            <Button v-if="!authStore.isAuthenticated" :to="signInHref" size="sm">
              Sign in to run
            </Button>
            <template v-else>
              <Button
                variant="outline"
                :loading="exerciseStore.isRunning"
                :disabled="exerciseStore.isRunning || exerciseStore.isSubmitting"
                @click="handleRun"
              >
                Run
              </Button>
              <Button
                :loading="exerciseStore.isSubmitting"
                :disabled="exerciseStore.isSubmitting || exerciseStore.isRunning"
                @click="handleSubmit"
              >
                Submit
              </Button>
            </template>
          </div>
        </div>
      </div>

      <!-- Results rail -->
      <aside
        v-if="!sessionForm"
        class="w-full shrink-0 overflow-y-auto border-t border-rule bg-muted/20 p-5 md:p-6 lg:w-[22rem] lg:border-l lg:border-t-0 xl:w-[26rem]"
        aria-label="Results"
      >
        <p class="eyebrow mb-4">results</p>

        <div
          v-if="exerciseStore.isRunning"
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
          running — practice, nothing recorded…
        </div>

        <!-- A run's outcome: feedback with a margin note, never a verdict. -->
        <div v-else-if="exerciseStore.latestRun" class="space-y-2">
          <TestResults
            :status="exerciseStore.latestRun.status"
            :results="exerciseStore.latestRun.testResults"
            :error-message="exerciseStore.latestRun.errorMessage"
            :execution-time="exerciseStore.latestRun.executionTimeMs"
          />
          <p class="font-mono text-xs text-muted-foreground">
            practice run — nothing recorded · submit to make it count<template
              v-if="exerciseStore.latestRun.runsRemainingToday !== null"
            >
              · {{ exerciseStore.latestRun.runsRemainingToday }} runs left today</template
            >
          </p>
        </div>

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
          v-if="exerciseStore.latestSubmission && !exerciseStore.latestRun"
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
            class="border-l-2 border-rule-strong pl-4 text-sm text-muted-foreground whitespace-pre-wrap break-words"
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

          <!--
            The onward path exists even before the rating. Rating stays the
            featured action — it sets the schedule — but skipping it must not
            strand someone on a finished exercise.
          -->
          <NuxtLink
            v-if="whatsNext?.next"
            :to="`/exercise/${whatsNext.next.id}`"
            class="mt-4 block font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {{ continueChrome(nextKind).verb }}: {{ whatsNext.next.title }} →
          </NuxtLink>
        </div>

        <!--
          Where to go now.
          
          Passing used to end here: the result on screen, the rating saved, and
          no way onward. The next exercise is almost always what someone wants,
          so it is the default rather than something to go and look for.
        -->
        <div
          v-else-if="
            exerciseStore.latestSubmission?.status === 'passed' &&
            ratingSubmittedFor === exerciseStore.latestSubmission.id
          "
          class="mt-5"
        >
          <p class="font-mono text-xs text-pass mb-4">
            rating saved — {{ scheduledPhrase ?? 'scheduled forward' }}
          </p>

          <div v-if="whatsNext?.next" class="border border-rule px-4 py-3">
            <p class="eyebrow mb-2">{{ continueChrome(nextKind).eyebrow }}</p>
            <p class="text-sm mb-1">{{ whatsNext.next.title }}</p>
            <p class="font-mono text-xs text-muted-foreground mb-4">
              {{ whatsNext.next.conceptName }}
              <span v-if="nextKind === 'due-recall'"> · already passed, due again</span>
              <span v-else-if="!whatsNext.next.sameConcept"> · new concept</span>
            </p>
            <NuxtLink :to="`/exercise/${whatsNext.next.id}`">
              <Button size="sm">
                {{ continueChrome(nextKind).verb }}
              </Button>
            </NuxtLink>
          </div>

          <div
            v-if="shouldShowTrackFinished(whatsNext)"
            class="rounded border border-rule bg-card p-4"
          >
            <p class="eyebrow mb-2">that was the last one</p>
            <p class="text-sm mb-4">
              You have finished every exercise in {{ whatsNext?.track.name }}.
            </p>
            <NuxtLink to="/tracks"><Button size="sm">Pick another track</Button></NuxtLink>
          </div>

          <!-- The reading behind the practice, for whoever wants the why. -->
          <NuxtLink
            v-if="conceptTutorial"
            :to="conceptTutorial.path"
            class="mt-4 block font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            the tutorial behind this: {{ conceptTutorial.title }} →
          </NuxtLink>

          <div class="mt-4 flex flex-wrap gap-3 font-mono text-xs">
            <NuxtLink
              v-if="whatsNext"
              :to="`/tracks/${whatsNext.track.slug}`"
              class="text-muted-foreground hover:text-foreground"
            >
              back to {{ whatsNext.track.name }}
            </NuxtLink>
            <NuxtLink to="/review" class="text-muted-foreground hover:text-foreground">
              what is due
            </NuxtLink>
          </div>
        </div>

        <p
          v-else-if="
            !exerciseStore.latestSubmission &&
            !exerciseStore.isSubmitting &&
            !exerciseStore.latestRun &&
            !exerciseStore.isRunning
          "
          class="font-mono text-sm text-muted-foreground"
        >
          Nothing run yet.
        </p>

        <div
          v-if="exerciseStore.submissionError"
          class="mt-5 border-l-2 border-fail bg-fail/5 p-4 text-sm text-fail break-words"
          role="alert"
        >
          {{ exerciseStore.submissionError }}
        </div>

        <div
          v-if="exerciseStore.runError"
          class="mt-5 border-l-2 border-fail bg-fail/5 p-4 text-sm text-fail break-words"
          role="alert"
        >
          {{ exerciseStore.runError }}
        </div>

        <div v-if="exerciseStore.exercise.hints?.length" class="mt-8 border-t border-rule pt-6">
          <HintsPanel
            :exercise="exerciseStore.exercise?.slug"
            :hints="exerciseStore.exercise.hints"
          />
        </div>

        <!--
          Unexplained agent pass: the schedule is held a day out until the
          human can say why the code is right. MCP can record this; so can
          this form — same POST, same substantive floor.
        -->
        <div
          v-if="awaitingExplanation"
          class="mt-8 border-t border-rule pt-6"
          aria-label="Explain this pass"
        >
          <p class="eyebrow mb-2">explain this pass</p>
          <p class="mb-3 max-w-[58ch] text-sm leading-relaxed text-muted-foreground">
            An agent passed this for you. The review is parked a day out until you can say why the
            code is right — in your words, not the suite's.
          </p>
          <p class="mb-2 text-sm leading-relaxed">{{ holdQuestion }}</p>
          <label class="sr-only" for="hold-explain-answer">Your explanation</label>
          <textarea
            id="hold-explain-answer"
            v-model="holdAnswer"
            rows="4"
            class="w-full resize-y border border-rule bg-background px-3 py-2 font-sans text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            :placeholder="`At least ${MIN_SUBSTANTIVE_REFLECTION_CHARS} characters — a real sentence, not “yes”.`"
            :disabled="holdBusy"
          />
          <div class="mt-3 flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              :disabled="holdBusy || !holdAnswer.trim()"
              :loading="holdBusy"
              @click="submitHoldExplanation"
            >
              {{ holdBusy ? 'Recording…' : 'Record explanation' }}
            </Button>
            <p v-if="holdError" class="text-sm text-fail" role="alert">{{ holdError }}</p>
            <p
              v-else-if="holdFeedback === 'hollow'"
              class="text-sm text-muted-foreground"
              role="status"
            >
              Recorded, but the schedule is still waiting for a real explanation.
            </p>
          </div>
        </div>

        <div
          v-if="holdFeedback === 'released'"
          class="mt-6 border-l-2 border-signal bg-signal/5 px-4 py-3 text-sm leading-relaxed"
          role="status"
        >
          The schedule believes this pass now — review moves to its earned interval.
        </div>

        <!-- Prior answers, agent- or site-written. Absent until one exists. -->
        <div v-if="reflections.length" class="mt-8 border-t border-rule pt-6">
          <p class="eyebrow mb-3">your reflections</p>
          <dl class="border border-rule">
            <div
              v-for="reflection in reflections"
              :key="reflection.id"
              class="border-b border-rule px-4 py-3 last:border-b-0"
            >
              <dt class="text-xs text-muted-foreground">{{ reflection.question }}</dt>
              <dd class="mt-1 text-sm leading-relaxed">{{ reflection.answer }}</dd>
            </div>
          </dl>
        </div>
      </aside>
    </div>
  </div>
</template>
