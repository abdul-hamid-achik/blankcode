import type { BlankRegionInStarter, Exercise, Submission } from '@blankcode/shared'
import { defineStore } from 'pinia'
import { extractBlankValues, reconstructCode } from '~/composables/useBlankEditor'

export const useExerciseStore = defineStore('exercise', () => {
  const exercise = ref<Exercise | null>(null)
  const submissions = ref<Submission[]>([])
  const currentCode = ref('')
  const codeSource = ref<'draft' | 'submission' | 'starter'>('starter')
  const blanks = ref<BlankRegionInStarter[]>([])
  const blankValues = ref<Map<string, string>>(new Map())
  const blankFeedback = ref<Map<string, 'correct' | 'incorrect'> | undefined>(undefined)
  const isSubmitting = ref(false)
  const latestSubmission = ref<Submission | null>(null)
  const isSaving = ref(false)
  const timedOut = ref(false)
  const submissionError = ref<string | null>(null)
  const loadError = ref<string | null>(null)
  let pollInterval: ReturnType<typeof setInterval> | null = null
  let autosaveTimer: ReturnType<typeof setTimeout> | null = null
  let pollStartTime = 0
  const POLL_TIMEOUT_MS = 90000

  const hasPassedSubmission = computed(() => submissions.value.some((s) => s.status === 'passed'))
  const isBlankMode = computed(() => blanks.value.length > 0)
  const filledBlanksCount = computed(() => {
    let count = 0
    for (const [, value] of blankValues.value) {
      if (value.trim().length > 0) count++
    }
    return count
  })

  async function fetchExerciseData(exerciseId: string) {
    const api = useApi()
    try {
      const progress = await api.exercises.getWithProgress(exerciseId)
      exercise.value = progress.exercise
      currentCode.value = progress.code
      codeSource.value = progress.codeSource
      return true
    } catch {
      // Fall back to basic exercise fetch (unauthenticated)
    }
    try {
      exercise.value = await api.exercises.getById(exerciseId)
      currentCode.value = exercise.value?.starterCode ?? ''
      return true
    } catch (e) {
      loadError.value = e instanceof Error ? e.message : 'Failed to load exercise'
      return false
    }
  }

  async function loadExercise(exerciseId: string) {
    loadError.value = null
    if (!(await fetchExerciseData(exerciseId))) return

    // Populate blank state from exercise data
    if (exercise.value?.blanks?.length) {
      blanks.value = exercise.value.blanks

      // If we have a draft or submission, extract blank values from the saved code
      if (codeSource.value !== 'starter' && currentCode.value !== exercise.value.starterCode) {
        blankValues.value = extractBlankValues(
          currentCode.value,
          exercise.value.starterCode,
          blanks.value
        )
      } else {
        blankValues.value = new Map()
      }
    }

    await loadSubmissions(exerciseId)
  }

  async function loadSubmissions(exerciseId: string) {
    const api = useApi()
    submissions.value = await api.submissions.getByExercise(exerciseId)
    latestSubmission.value = submissions.value[0] ?? null
  }

  function handlePollTimeout() {
    timedOut.value = true
    stopPolling()
    isSubmitting.value = false
  }

  function handleSubmissionComplete() {
    timedOut.value = false
    stopPolling()
    isSubmitting.value = false
    if (isBlankMode.value) {
      computeBlankFeedback()
    }
  }

  async function pollSubmissionStatus(submissionId: string) {
    stopPolling()
    timedOut.value = false
    pollStartTime = Date.now()

    pollInterval = setInterval(async () => {
      const api = useApi()
      const isTimedOut = Date.now() - pollStartTime >= POLL_TIMEOUT_MS
      try {
        if (isTimedOut) {
          handlePollTimeout()
          return
        }

        const updated = await api.submissions.getById(submissionId)
        latestSubmission.value = updated

        const idx = submissions.value.findIndex((s) => s.id === submissionId)
        if (idx >= 0) {
          submissions.value[idx] = updated
        }

        if (updated.status !== 'pending' && updated.status !== 'running') {
          handleSubmissionComplete()
        }
      } catch {
        // Don't give up on transient errors (429, network blips) — just skip this tick
        if (isTimedOut) {
          handlePollTimeout()
        }
      }
    }, 2000)
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
  }

  function stopAutosave() {
    if (autosaveTimer) {
      clearTimeout(autosaveTimer)
      autosaveTimer = null
    }
  }

  async function saveDraft(code: string) {
    if (!exercise.value) return
    const api = useApi()
    isSaving.value = true
    try {
      await api.exercises.saveDraft(exercise.value.id, code)
      codeSource.value = 'draft'
    } catch (_error) {
      // Don't throw - draft save failure shouldn't block the user
    } finally {
      isSaving.value = false
    }
  }

  function updateCode(code: string) {
    currentCode.value = code
    stopAutosave()
    autosaveTimer = setTimeout(() => saveDraft(code), 10000)
  }

  function updateBlankValues(values: Map<string, string>) {
    blankValues.value = values
    blankFeedback.value = undefined

    // Reconstruct full code from blank values for autosave
    if (exercise.value && blanks.value.length > 0) {
      const code = reconstructCode(exercise.value.starterCode, blanks.value, values)
      currentCode.value = code
      stopAutosave()
      autosaveTimer = setTimeout(() => saveDraft(code), 10000)
    }
  }

  function computeBlankFeedback() {
    const feedback = new Map<string, 'correct' | 'incorrect'>()
    for (const blank of blanks.value) {
      const value = blankValues.value.get(blank.id) ?? ''
      feedback.set(blank.id, value.trim() === blank.solution.trim() ? 'correct' : 'incorrect')
    }
    blankFeedback.value = feedback
  }

  async function submitCode(code?: string) {
    if (!exercise.value) return
    if (isSubmitting.value) return

    // In blank mode, reconstruct the code from blank values
    const submitCode = isBlankMode.value
      ? reconstructCode(exercise.value.starterCode, blanks.value, blankValues.value)
      : (code ?? currentCode.value)

    const api = useApi()
    submissionError.value = null
    isSubmitting.value = true
    stopAutosave()
    try {
      const submission = await api.submissions.create({
        exerciseId: exercise.value.id,
        code: submitCode,
      })
      latestSubmission.value = submission
      submissions.value = [submission, ...submissions.value]

      await api.exercises.deleteDraft(exercise.value.id)
      codeSource.value = 'submission'

      pollSubmissionStatus(submission.id)

      return submission
    } catch (e) {
      isSubmitting.value = false
      submissionError.value = e instanceof Error ? e.message : 'Submission failed'
    }
  }

  async function retrySubmission(submissionId: string) {
    const api = useApi()
    timedOut.value = false
    await api.submissions.retry(submissionId)
    pollSubmissionStatus(submissionId)
  }

  function reset() {
    stopPolling()
    stopAutosave()
    exercise.value = null
    submissions.value = []
    currentCode.value = ''
    blanks.value = []
    blankValues.value = new Map()
    blankFeedback.value = undefined
    codeSource.value = 'starter'
    isSubmitting.value = false
    isSaving.value = false
    latestSubmission.value = null
    timedOut.value = false
    submissionError.value = null
    loadError.value = null
  }

  return {
    exercise,
    submissions,
    currentCode,
    codeSource,
    blanks,
    blankValues,
    blankFeedback,
    isBlankMode,
    filledBlanksCount,
    isSubmitting,
    isSaving,
    latestSubmission,
    timedOut,
    submissionError,
    loadError,
    hasPassedSubmission,
    loadExercise,
    loadSubmissions,
    submitCode,
    retrySubmission,
    updateCode,
    updateBlankValues,
    computeBlankFeedback,
    reset,
    stopPolling,
    stopAutosave,
  }
})
