<script setup lang="ts">
import { computed, ref } from 'vue'
import Card from '~/components/ui/card.vue'
import { useAsync } from '~/composables/useAsync'

definePageMeta({ requiresAuth: false })

const api = useApi()
const selectedTrack = ref<string>('all')
const selectedDifficulty = ref<string>('all')

const { data: tracks, isLoading: tracksLoading } = useAsync(() => api.tracks.getAll())
const { data: allExercises, isLoading: exercisesLoading } = useAsync(() => api.exercises.getAll())

const isLoading = computed(() => tracksLoading.value || exercisesLoading.value)

// Filter exercises to only challenges
const challenges = computed(() => {
  if (!allExercises.value) return []

  let filtered = allExercises.value.filter((ex) => ex.type === 'challenge')

  if (selectedTrack.value !== 'all') {
    filtered = filtered.filter((ex) => ex.conceptId.startsWith(selectedTrack.value))
  }

  if (selectedDifficulty.value !== 'all') {
    filtered = filtered.filter((ex) => ex.difficulty === selectedDifficulty.value)
  }

  return filtered
})

const trackOptions = computed(() => {
  if (!tracks.value) return []
  return [
    {
      value: 'all',
      label: 'All Tracks',
      count: allExercises.value?.filter((e) => e.type === 'challenge').length || 0,
    },
    ...tracks.value.map((track) => ({
      value: track.slug,
      label: track.name,
      count:
        allExercises.value?.filter(
          (e) => e.type === 'challenge' && e.conceptId.startsWith(track.slug)
        ).length || 0,
    })),
  ]
})

const difficultyOptions = [
  { value: 'all', label: 'All Difficulties' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'expert', label: 'Expert' },
]

const difficultyColors: Record<string, string> = {
  beginner: 'bg-green-500/10 text-green-500 border-green-500/20',
  intermediate: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  advanced: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  expert: 'bg-red-500/10 text-red-500 border-red-500/20',
}

const trackIcons: Record<string, string> = {
  typescript: '📘',
  python: '🐍',
  go: '🐹',
  rust: '🦀',
  react: '⚛️',
  vue: '💚',
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-background to-muted/20">
    <!-- Hero Section -->
    <div class="border-b border-border bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-blue-500/10">
      <div class="container py-16">
        <div class="max-w-3xl">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm mb-4">
            <span>🏆</span>
            <span>Test Your Skills</span>
          </div>
          <h1 class="text-4xl md:text-5xl font-bold mb-4">
            Coding Challenges
          </h1>
          <p class="text-lg text-muted-foreground mb-6">
            Implement complete solutions from scratch. No blanks, no hints—just you and the code.
          </p>
          <div class="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-purple-500"></span>
              <span>{{ challenges.length }} challenges available</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>{{ tracks?.length || 0 }} languages</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-green-500"></span>
              <span>Real-world scenarios</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="container py-8">
      <!-- Filters -->
      <div class="flex flex-col md:flex-row gap-4 mb-8">
        <div class="flex-1">
          <label class="text-sm font-medium mb-2 block">Track</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="option in trackOptions"
              :key="option.value"
              @click="selectedTrack = option.value"
              :class="[
                'px-4 py-2 rounded-lg border text-sm font-medium transition-colors',
                selectedTrack === option.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-muted border-border',
              ]"
            >
              <span class="mr-2">{{ trackIcons[option.value] || '📚' }}</span>
              {{ option.label }}
              <span class="ml-2 px-2 py-0.5 rounded-full bg-white/10 text-xs">
                {{ option.count }}
              </span>
            </button>
          </div>
        </div>
        <div class="w-full md:w-64">
          <label class="text-sm font-medium mb-2 block">Difficulty</label>
          <select
            v-model="selectedDifficulty"
            class="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option
              v-for="option in difficultyOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </div>
      </div>

      <!-- Challenges Grid -->
      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <div class="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>

      <div v-else-if="challenges.length === 0" class="text-center py-12">
        <div class="text-6xl mb-4">🔜</div>
        <h3 class="text-xl font-semibold mb-2">No challenges found</h3>
        <p class="text-muted-foreground">
          Try adjusting your filters or check back later for new challenges.
        </p>
      </div>

      <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <NuxtLink
          v-for="exercise in challenges"
          :key="exercise.id"
          :to="`/exercise/${exercise.id}`"
        >
          <Card class="hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer h-full group">
            <div class="p-6">
              <div class="flex items-start justify-between mb-3">
                <div class="text-2xl">
                  {{ trackIcons[exercise.conceptId.split('-')[0]] || '📚' }}
                </div>
                <span
                  :class="[
                    'text-xs px-2.5 py-1 rounded-full border font-medium',
                    difficultyColors[exercise.difficulty],
                  ]"
                >
                  {{ exercise.difficulty }}
                </span>
              </div>
              
              <h3 class="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">
                {{ exercise.title }}
              </h3>
              
              <p class="text-sm text-muted-foreground line-clamp-2 mb-4">
                {{ exercise.description }}
              </p>
              
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 text-xs text-muted-foreground">
                  <span class="flex items-center gap-1">
                    <span>🏆</span>
                    Challenge
                  </span>
                  <span>•</span>
                  <span>{{ exercise.conceptId.split('-').slice(0, -1).join(' ') || 'Challenge' }}</span>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="text-muted-foreground group-hover:translate-x-1 transition-transform"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </div>
            </div>
          </Card>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
