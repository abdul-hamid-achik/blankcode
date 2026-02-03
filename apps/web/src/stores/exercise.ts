import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Exercise, Submission, BlankRegion } from '@blankcode/shared'
import { api } from '@/api'

export const useExerciseStore = defineStore('exercise', () => {
  const exercise = ref<Exercise | null>(null)
  const submissions = ref<Submission[]>([])
  const currentCode = ref('')
  const blanks = ref<BlankRegion[]>([])
  const isSubmitting = ref(false)
  const latestSubmission = ref<Submission | null>(null)
  let pollInterval: ReturnType<typeof setInterval> | null = null

  const hasPassedSubmission = computed(() =>
    submissions.value.some((s) => s.status === 'passed')
  )

  async function loadExercise(exerciseId: string) {
    exercise.value = await api.exercises.getById(exerciseId)
    currentCode.value = exercise.value?.starterCode ?? ''
    await loadSubmissions(exerciseId)
  }

  async function loadSubmissions(exerciseId: string) {
    submissions.value = await api.submissions.getByExercise(exerciseId)
    latestSubmission.value = submissions.value[0] ?? null
  }

  async function pollSubmissionStatus(submissionId: string) {
    stopPolling()

    pollInterval = setInterval(async () => {
      try {
        const updated = await api.submissions.getById(submissionId)
        latestSubmission.value = updated

        // Update in submissions list
        const idx = submissions.value.findIndex((s) => s.id === submissionId)
        if (idx >= 0) {
          submissions.value[idx] = updated
        }

        // Stop polling when submission is complete
        if (updated.status !== 'pending' && updated.status !== 'running') {
          stopPolling()
        }
      } catch {
        stopPolling()
      }
    }, 1000)
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
  }

  async function submitCode(code: string) {
    if (!exercise.value) return

    isSubmitting.value = true
    try {
      const submission = await api.submissions.create({
        exerciseId: exercise.value.id,
        code,
      })
      latestSubmission.value = submission
      submissions.value = [submission, ...submissions.value]

      // Start polling for status updates
      pollSubmissionStatus(submission.id)

      return submission
    } finally {
      isSubmitting.value = false
    }
  }

  function updateCode(code: string) {
    currentCode.value = code
  }

  function reset() {
    stopPolling()
    exercise.value = null
    submissions.value = []
    currentCode.value = ''
    blanks.value = []
    isSubmitting.value = false
    latestSubmission.value = null
  }

  return {
    exercise,
    submissions,
    currentCode,
    blanks,
    isSubmitting,
    latestSubmission,
    hasPassedSubmission,
    loadExercise,
    loadSubmissions,
    submitCode,
    updateCode,
    reset,
    stopPolling,
  }
})
