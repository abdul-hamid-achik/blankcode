import type { ReviewExercise } from '@blankcode/shared'
import { defineStore } from 'pinia'

export const useReviewStore = defineStore('review', () => {
  const dueExercises = ref<ReviewExercise[]>([])
  const dueCount = ref(0)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function loadDueReviews() {
    const api = useApi()
    isLoading.value = true
    error.value = null
    try {
      dueExercises.value = await api.reviews.getDue()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load due reviews'
    } finally {
      isLoading.value = false
    }
  }

  async function loadDueCount() {
    const api = useApi()
    try {
      const result = await api.reviews.getDueCount()
      dueCount.value = result.count
    } catch (_e) {
      dueCount.value = 0
    }
  }

  async function completeReview(exerciseId: string, passed: boolean) {
    const api = useApi()
    await api.reviews.complete(exerciseId, passed)
    dueExercises.value = dueExercises.value.filter((e) => e.id !== exerciseId)
    dueCount.value = Math.max(0, dueCount.value - 1)
  }

  return {
    dueExercises,
    dueCount,
    isLoading,
    error,
    loadDueReviews,
    loadDueCount,
    completeReview,
  }
})
