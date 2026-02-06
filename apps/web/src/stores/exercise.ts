import type { BlankRegion, Exercise, Submission } from '@blankcode/shared'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/api'

export const useExerciseStore = defineStore('exercise', () => {
  const exercise = ref<Exercise | null>(null)
  const submissions = ref<Submission[]>([])
  const currentCode = ref('')
  const codeSource = ref<'draft' | 'submission' | 'starter'>('starter')
  const blanks = ref<BlankRegion[]>([])
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

  async function loadExercise(exerciseId: string) {
    loadError.value = null
    try {
      const progress = await api.exercises.getWithProgress(exerciseId)
      exercise.value = progress.exercise
      currentCode.value = progress.code
      codeSource.value = progress.codeSource
    } catch {
      try {
        exercise.value = await api.exercises.getById(exerciseId)
        currentCode.value = exercise.value?.starterCode ?? ''
      } catch (e) {
        loadError.value = e instanceof Error ? e.message : 'Failed to load exercise'
        return
      }
    }
    await loadSubmissions(exerciseId)
  }

  async function loadSubmissions(exerciseId: string) {
    submissions.value = await api.submissions.getByExercise(exerciseId)
    latestSubmission.value = submissions.value[0] ?? null
  }

  async function pollSubmissionStatus(submissionId: string) {
    stopPolling()
    timedOut.value = false
    pollStartTime = Date.now()

    pollInterval = setInterval(async () => {
      try {
        if (Date.now() - pollStartTime >= POLL_TIMEOUT_MS) {
          timedOut.value = true
          stopPolling()
          isSubmitting.value = false
          return
        }

        const updated = await api.submissions.getById(submissionId)
        latestSubmission.value = updated

        const idx = submissions.value.findIndex((s) => s.id === submissionId)
        if (idx >= 0) {
          submissions.value[idx] = updated
        }

        if (updated.status !== 'pending' && updated.status !== 'running') {
          timedOut.value = false
          stopPolling()
          isSubmitting.value = false
        }
      } catch {
        // Don't give up on transient errors (429, network blips) — just skip this tick
        if (Date.now() - pollStartTime >= POLL_TIMEOUT_MS) {
          timedOut.value = true
          stopPolling()
          isSubmitting.value = false
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
    isSaving.value = true
    try {
      await api.exercises.saveDraft(exercise.value.id, code)
      codeSource.value = 'draft'
    } catch {
    } finally {
      isSaving.value = false
    }
  }

  function updateCode(code: string) {
    currentCode.value = code
    stopAutosave()
    autosaveTimer = setTimeout(() => saveDraft(code), 10000)
  }

  async function submitCode(code: string) {
    if (!exercise.value) return
    if (isSubmitting.value) return

    submissionError.value = null
    isSubmitting.value = true
    stopAutosave()
    try {
      const submission = await api.submissions.create({
        exerciseId: exercise.value.id,
        code,
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
    reset,
    stopPolling,
    stopAutosave,
  }
})
