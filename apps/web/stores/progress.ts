import { defineStore } from 'pinia'

interface TrackProgress {
  trackSlug: string
  trackName: string
  totalExercises: number
  completedExercises: number
  masteryLevel: number
}

interface UserStats {
  totalExercisesCompleted: number
  currentStreak: number
  longestStreak: number
  totalSubmissions: number
  lastActivityDate: string | null
}

interface ConceptProgress {
  conceptId: string
  conceptSlug: string
  conceptName: string
  totalExercises: number
  exercisesCompleted: number
  masteryLevel: number
}

export const useProgressStore = defineStore('progress', () => {
  const trackProgress = ref<TrackProgress[]>([])
  const userStats = ref<UserStats | null>(null)
  const conceptsProgress = ref<Record<string, ConceptProgress[]>>({})
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const totalCompleted = computed(() => userStats.value?.totalExercisesCompleted ?? 0)
  const currentStreak = computed(() => userStats.value?.currentStreak ?? 0)

  async function loadStats() {
    const api = useApi()
    isLoading.value = true
    error.value = null
    try {
      const stats = await api.progress.getStats()
      userStats.value = stats
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load stats'
    } finally {
      isLoading.value = false
    }
  }

  async function loadAllTracksProgress() {
    const api = useApi()
    isLoading.value = true
    error.value = null
    try {
      const progress = await api.progress.getSummary()
      trackProgress.value = progress
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load progress'
    } finally {
      isLoading.value = false
    }
  }

  async function loadTrackProgress(trackSlug: string) {
    const api = useApi()
    try {
      const progress = await api.progress.getTrack(trackSlug)
      conceptsProgress.value[trackSlug] = progress as ConceptProgress[]
    } catch (_e) {}
  }

  function reset() {
    trackProgress.value = []
    userStats.value = null
    conceptsProgress.value = {}
    isLoading.value = false
    error.value = null
  }

  return {
    trackProgress,
    userStats,
    conceptsProgress,
    isLoading,
    error,
    totalCompleted,
    currentStreak,
    loadStats,
    loadAllTracksProgress,
    loadTrackProgress,
    reset,
  }
})
