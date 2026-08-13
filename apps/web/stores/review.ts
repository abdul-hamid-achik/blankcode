import type { ReviewExercise } from '@blankcode/shared'
import { defineStore } from 'pinia'

export const useReviewStore = defineStore('review', () => {
  const dueExercises = ref<ReviewExercise[]>([])
  const dueCount = ref(0)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  /**
   * How many reviews this sitting has closed. Lets the queue page end with
   * "that's the queue — 5 reviewed" instead of the generic empty state, which
   * reads like you were never there.
   */
  const completedThisSession = ref(0)
  /**
   * Ids closed in this sitting. The Review page hydrates from a cached
   * useAsyncData payload; without this list that payload puts a just-passed
   * item back on the worklist the moment you return to the tab.
   */
  const passedThisSession = ref<string[]>([])

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

  async function completeReview(exerciseId: string, passed: boolean, quality?: 3 | 4 | 5) {
    const api = useApi()
    const schedule = await api.reviews.complete(exerciseId, passed, quality)
    const wasDue = dueExercises.value.some((e) => e.id === exerciseId) || dueCount.value > 0
    dueExercises.value = dueExercises.value.filter((e) => e.id !== exerciseId)
    dueCount.value = Math.max(0, dueCount.value - 1)
    if (wasDue) {
      completedThisSession.value += 1
      if (!passedThisSession.value.includes(exerciseId)) {
        passedThisSession.value = [...passedThisSession.value, exerciseId]
      }
    }
    // The date the rating just set — the page gets to say it out loud.
    return schedule
  }

  return {
    dueExercises,
    dueCount,
    completedThisSession,
    passedThisSession,
    isLoading,
    error,
    loadDueReviews,
    loadDueCount,
    completeReview,
  }
})
