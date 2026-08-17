<script setup lang="ts">
import type { Exercise, Track } from '@blankcode/shared'
import { computed, ref } from 'vue'
import EmptyState from '~/components/error/empty-state.vue'
import Card from '~/components/ui/card.vue'
import DifficultyTag from '~/components/ui/difficulty-tag.vue'
import { usePageSeo } from '~/composables/usePageSeo'
import { useAuthStore } from '~/stores/auth'
import {
  challengeBelongsToTrack,
  trackLabelForExercise,
  type CatalogExercise,
} from '~/utils/challenge-catalog'

definePageMeta({ requiresAuth: false })

const selectedTrack = ref<string>('all')
const selectedDifficulty = ref<string>('all')
const auth = useAuthStore()

/*
 * Both lists are public, so they are fetched during the render.
 *
 * This page has had two bugs in the same three lines. First it called
 * `useAsync` without ever executing it, so the list was empty for everyone —
 * `useAsync` does not fetch on its own. Then it fetched on mount, which fixed
 * the browser and left the server rendering a single heading, so the page a
 * reader would find by searching for coding challenges had no challenges in it.
 */
const { data: tracks, pending: tracksLoading } = await useAsyncData('challenge-tracks', () =>
  $fetch<Track[]>('/api/tracks')
)
const { data: allExercises, pending: exercisesLoading } = await useAsyncData(
  'challenge-exercises',
  () => $fetch<Exercise[]>('/api/exercises')
)

const isLoading = computed(() => tracksLoading.value || exercisesLoading.value)

// Filter exercises to only challenges
const catalog = computed(() => (allExercises.value ?? []) as Array<Exercise & CatalogExercise>)

const challenges = computed(() => {
  let filtered = catalog.value.filter((ex) => ex.type === 'challenge')

  if (selectedTrack.value !== 'all') {
    filtered = filtered.filter((ex) => challengeBelongsToTrack(ex, selectedTrack.value))
  }

  if (selectedDifficulty.value !== 'all') {
    filtered = filtered.filter((ex) => ex.difficulty === selectedDifficulty.value)
  }

  return filtered
})

const trackOptions = computed(() => {
  if (!tracks.value) return []
  const challengeRows = catalog.value.filter((e) => e.type === 'challenge')
  return [
    {
      value: 'all',
      label: 'All Tracks',
      count: challengeRows.length,
    },
    ...tracks.value.map((track) => ({
      value: track.slug,
      label: track.name,
      count: challengeRows.filter((e) => challengeBelongsToTrack(e, track.slug)).length,
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

usePageSeo({
  title: 'Challenges — BlankCode',
  description:
    'Write the whole thing, not just the blanks. Graded by the exercise’s real test suite in a sandbox.',
  path: '/challenges',
})
</script>

<template>
  <div class="min-h-screen">
    <!-- Hero Section -->
    <div class="border-b border-rule">
      <div class="container py-12">
        <div class="max-w-2xl">
          <p class="eyebrow mb-2">challenges</p>
          <h1 class="display text-2xl md:text-3xl mb-3">No blanks. Write the whole thing.</h1>
          <p class="text-muted-foreground">
            Same test suites, nothing filled in for you. Use these when an exercise has stopped
            being hard.
          </p>
          <p v-if="!isLoading" class="mt-4 font-mono text-xs text-muted-foreground">
            {{ challenges.length }} available
          </p>
        </div>
      </div>
    </div>

    <div class="container py-8">
      <!-- Filters -->
      <div class="flex flex-col md:flex-row gap-4 mb-8">
        <div class="flex-1">
          <label class="eyebrow mb-2 block">Track</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="option in trackOptions"
              :key="option.value"
              @click="selectedTrack = option.value"
              :class="[
                'border px-3 py-1.5 font-mono text-xs transition-colors',
                selectedTrack === option.value
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-rule bg-background hover:bg-muted',
              ]"
            >
              {{ option.label }}
              <span class="ml-2 opacity-60">
                {{ option.count }}
              </span>
            </button>
          </div>
        </div>
        <div class="w-full md:w-64">
          <label class="eyebrow mb-2 block">Difficulty</label>
          <select
            v-model="selectedDifficulty"
            class="w-full border border-rule bg-background px-3 py-1.5 font-mono text-xs"
          >
            <option v-for="option in difficultyOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
      </div>

      <!-- Challenges Grid -->
      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <div
          class="animate-spin h-6 w-6 border-2 border-rule-strong border-t-signal rounded-full"
        ></div>
      </div>

      <EmptyState
        v-else-if="challenges.length === 0"
        eyebrow="nothing matches"
        title="No challenges for those filters."
        description="Widen the track or difficulty. Every published challenge is on this page."
      />

      <ul v-else class="grid gap-px border border-rule bg-rule md:grid-cols-2 lg:grid-cols-3">
        <li v-for="exercise in challenges" :key="exercise.id" class="bg-background">
          <NuxtLink
            :to="`/exercise/${exercise.id}`"
            class="flex h-full flex-col p-5 transition-colors hover:bg-muted/60"
          >
            <div class="mb-3 flex items-start justify-between gap-3">
              <span class="eyebrow">{{ trackLabelForExercise(exercise) }}</span>
              <DifficultyTag :difficulty="exercise.difficulty" show-rank />
            </div>

            <h2 class="display mb-2 text-base">{{ exercise.title }}</h2>

            <p class="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
              {{ exercise.description }}
            </p>
            <p v-if="!auth.isAuthenticated" class="mt-3 font-mono text-xs text-muted-foreground">
              Sign in to run the suite
            </p>
          </NuxtLink>
        </li>
      </ul>
    </div>
  </div>
</template>
