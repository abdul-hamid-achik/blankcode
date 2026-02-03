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
      return submission
    } finally {
      isSubmitting.value = false
    }
  }

  function updateCode(code: string) {
    currentCode.value = code
  }

  function reset() {
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
  }
})
