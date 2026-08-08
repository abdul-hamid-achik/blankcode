<script setup lang="ts">
import { TRACK_SLUGS, type Concept, type Exercise, type Track } from '@blankcode/shared'
import Card from '~/components/ui/card.vue'
import { useAuthStore } from '~/stores/auth'

const route = useRoute()
const trackSlug = computed(() => route.params['trackSlug'] as string)
const conceptSlug = computed(() => route.params['conceptSlug'] as string)

if (!TRACK_SLUGS.includes(trackSlug.value as (typeof TRACK_SLUGS)[number])) {
  throw createError({ statusCode: 404, statusMessage: 'Track not found', fatal: true })
}

/*
 * Server-rendered, like the track page and for the same reason: this used to
 * load in `onMounted`, so a crawler landing on "typescript generics
 * exercises" saw a spinner. The track fetch shares its key with the track
 * page, so navigating down from there costs nothing extra — and it is what
 * lets the heading say the concept's *name*. The h1 used to render the raw
 * slug, on the surface whose whole job is naming the thing you are studying.
 */
const [{ data: exercises, pending: isLoading }, { data: track }] = await Promise.all([
  useAsyncData(
    () => `concept-exercises-${trackSlug.value}-${conceptSlug.value}`,
    () =>
      $fetch<Exercise[]>(`/api/tracks/${trackSlug.value}/concepts/${conceptSlug.value}/exercises`)
  ),
  useAsyncData(
    () => `track-${trackSlug.value}`,
    () => $fetch<Track & { concepts?: Concept[] }>(`/api/tracks/${trackSlug.value}`)
  ),
])

const concept = computed(() => track.value?.concepts?.find((c) => c.slug === conceptSlug.value))

useSeoMeta({
  title: () => `${concept.value?.name ?? conceptSlug.value} — ${track.value?.name ?? 'BlankCode'}`,
  description: () => concept.value?.description ?? 'Practice exercises for this concept.',
})

/** Done-marks per exercise: the user's real completions, or nothing. */
const auth = useAuthStore()
const api = useApi()
const completedIds = ref<Set<string> | null>(null)

onMounted(async () => {
  if (!auth.isAuthenticated) return
  try {
    completedIds.value = new Set(await api.progress.completed())
  } catch {
    // No marks over wrong marks.
  }
})

const isDone = (id: string) => completedIds.value?.has(id) ?? false

const difficultyColors: Record<string, string> = {
  beginner: 'bg-green-500/10 text-green-500',
  intermediate: 'bg-yellow-500/10 text-yellow-500',
  advanced: 'bg-orange-500/10 text-orange-500',
  expert: 'bg-red-500/10 text-red-500',
}

const exerciseTypeBadges: Record<string, { label: string; icon: string; color: string }> = {
  blank: { label: 'Fill-in-Blank', icon: '📝', color: 'bg-blue-500/10 text-blue-500' },
  challenge: { label: 'Challenge', icon: '🏆', color: 'bg-purple-500/10 text-purple-500' },
  // A review used to fall through this map and render an empty pill — a badge
  // with nothing in it, on the type whose whole point is that looks deceive.
  review: { label: 'Code Review', icon: '🔎', color: 'bg-amber-500/10 text-amber-600' },
  turn: { label: 'Turn-Budget Session', icon: '✉️', color: 'bg-emerald-500/10 text-emerald-600' },
  context: {
    label: 'Context Session',
    icon: '🧾',
    color: 'bg-cyan-500/10 text-cyan-600',
  },
}
</script>

<template>
  <div class="container py-12">
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <div
        class="animate-spin h-6 w-6 border-2 border-rule-strong border-t-signal rounded-full"
      ></div>
    </div>

    <div v-else class="max-w-4xl mx-auto">
      <div class="mb-8">
        <NuxtLink
          :to="`/tracks/${trackSlug}`"
          class="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block"
        >
          &larr; Back to {{ track?.name ?? 'Track' }}
        </NuxtLink>
        <h1 class="display text-2xl md:text-3xl mb-2">{{ concept?.name ?? conceptSlug }}</h1>
        <p class="text-muted-foreground">
          {{ concept?.description ?? 'Practice exercises for this concept.' }}
        </p>
      </div>

      <div v-if="exercises?.length" class="grid gap-4">
        <NuxtLink v-for="exercise in exercises" :key="exercise.id" :to="`/exercise/${exercise.id}`">
          <Card class="hover:border-rule-strong transition-colors cursor-pointer">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2 mb-1">
                  <!-- The mark that you have been here and won. -->
                  <span
                    v-if="isDone(exercise.id)"
                    class="font-mono text-xs text-pass"
                    title="Completed"
                    aria-label="Completed"
                    >✓</span
                  >
                  <h3 class="font-semibold">{{ exercise.title }}</h3>
                  <span
                    :class="[
                      'text-xs px-2 py-0.5 rounded-full',
                      difficultyColors[exercise.difficulty],
                    ]"
                  >
                    {{ exercise.difficulty }}
                  </span>
                  <span
                    :class="[
                      'text-xs px-2 py-0.5 rounded-full',
                      exerciseTypeBadges[exercise.type || 'blank']?.color,
                    ]"
                    :title="exerciseTypeBadges[exercise.type || 'blank']?.label"
                  >
                    {{ exerciseTypeBadges[exercise.type || 'blank']?.icon }}
                  </span>
                </div>
                <p class="text-sm text-muted-foreground line-clamp-2">
                  {{ exercise.description }}
                </p>
              </div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="text-muted-foreground flex-shrink-0"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </div>
          </Card>
        </NuxtLink>
      </div>

      <div
        v-else-if="exercises && exercises.length === 0"
        class="text-center py-8 text-muted-foreground"
      >
        Nothing here yet — this concept's exercises are still being written.
      </div>
    </div>
  </div>
</template>
