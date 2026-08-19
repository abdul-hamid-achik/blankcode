<script setup lang="ts">
import { TRACK_SLUGS, type Concept, type Track } from '@blankcode/shared'
import Card from '~/components/ui/card.vue'
import { AUTH_COOKIE_OPTIONS } from '~/utils/auth-cookie'

const route = useRoute()
const trackSlug = computed(() => route.params['trackSlug'] as string)

// The slugs are a fixed set, so an unknown one is knowable without a request.
if (!TRACK_SLUGS.includes(trackSlug.value as (typeof TRACK_SLUGS)[number])) {
  throw createError({ statusCode: 404, statusMessage: 'Track not found', fatal: true })
}

/*
 * Fetched with `useAsyncData` rather than on mount.
 *
 * This page used to load its data in `onMounted`, so the server rendered a
 * spinner and nothing else: 8kB of markup with no track name and no concepts.
 * A crawler saw an empty page, which for the pages someone finds by searching
 * "rust exercises" is the whole audience gone. `routeRules` already said
 * `ssr: true` for this route; the data flow was quietly ignoring it.
 *
 * `$fetch` rather than `useApi`, which builds a relative URL and calls `fetch`
 * directly — fine in a browser, impossible on the server. On the server this
 * routes into Nitro without a network round trip. The endpoint is public, so
 * there is no token to forward.
 */
const { data: track, pending: isLoading } = await useAsyncData(
  () => `track-${trackSlug.value}`,
  () => $fetch<Track & { concepts?: Concept[] }>(`/api/tracks/${trackSlug.value}`)
)

if (!track.value) {
  throw createError({ statusCode: 404, statusMessage: 'Track not found', fatal: true })
}

/*
 * The user's own marks on the page. `conceptsProgress` sat computed in the
 * store while this page rendered every concept identically — a returning
 * learner could not see which door they had already been through.
 *
 * This used to fetch after mount behind `isAuthenticated`, which lost the
 * race with layout initialize() and then read `mastery.exercisesCompleted`
 * — a row that is missing until a later upsert, so a real sitting showed 0.
 */
interface ConceptProgressRow {
  conceptSlug: string
  totalExercises: number
  completedExercises: number
}

const { data: progressRows } = await useAsyncData(
  () => `track-progress-${trackSlug.value}`,
  () => {
    const token = useCookie<string | null>('token', AUTH_COOKIE_OPTIONS).value
    if (!token) return Promise.resolve([] as ConceptProgressRow[])
    return $fetch<ConceptProgressRow[]>(`/api/progress/tracks/${trackSlug.value}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  }
)

const progressBySlug = computed(() => {
  const map = new Map<string, { completed: number; total: number }>()
  for (const row of progressRows.value ?? []) {
    map.set(row.conceptSlug, { completed: row.completedExercises, total: row.totalExercises })
  }
  return map
})

const conceptProgress = (slug: string) => progressBySlug.value.get(slug) ?? null

useSeoMeta({
  title: () => track.value?.name ?? 'Track',
  description: () => track.value?.description ?? '',
  ogTitle: () => `${track.value?.name} exercises`,
  ogDescription: () => track.value?.description ?? '',
})
</script>

<template>
  <div class="container py-12">
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <div
        class="animate-spin h-6 w-6 border-2 border-rule-strong border-t-signal rounded-full"
      ></div>
    </div>

    <div v-else-if="track" class="max-w-4xl mx-auto">
      <div class="mb-8">
        <NuxtLink
          to="/tracks"
          class="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block"
        >
          &larr; Back to Tracks
        </NuxtLink>
        <h1 class="display text-2xl md:text-3xl mb-2">{{ track.name }}</h1>
        <p class="text-muted-foreground">{{ track.description }}</p>
        <p class="mt-4 font-mono text-xs text-muted-foreground">
          <NuxtLink to="/reading" class="underline decoration-signal/60 underline-offset-2">
            Reading
          </NuxtLink>
          is a separate door: a whole small codebase, graded on what you can say about it.
        </p>
      </div>

      <h2 class="display text-lg mb-4">Concepts</h2>

      <div v-if="track.concepts?.length" class="grid gap-4">
        <NuxtLink
          v-for="concept in track.concepts"
          :key="concept.id"
          :to="`/tracks/${trackSlug}/${concept.slug}`"
        >
          <Card class="hover:border-rule-strong transition-colors cursor-pointer">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0 flex-1">
                <h3 class="font-semibold">{{ concept.name }}</h3>
                <p class="text-sm text-muted-foreground">{{ concept.description }}</p>
              </div>
              <div class="flex shrink-0 items-center gap-3">
                <!-- Your marks on the paper: real counts, or nothing. -->
                <span
                  v-if="conceptProgress(concept.slug)"
                  class="font-mono text-xs"
                  :class="
                    (conceptProgress(concept.slug)?.completed ?? 0) >=
                      (conceptProgress(concept.slug)?.total ?? 1) &&
                    (conceptProgress(concept.slug)?.total ?? 0) > 0
                      ? 'text-pass'
                      : 'text-muted-foreground'
                  "
                >
                  {{ conceptProgress(concept.slug)?.completed }}/{{
                    conceptProgress(concept.slug)?.total
                  }}
                </span>
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
                  class="shrink-0 text-muted-foreground"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </div>
            </div>
          </Card>
        </NuxtLink>
      </div>

      <div v-else class="text-center py-12 text-muted-foreground">No concepts available yet.</div>
    </div>

    <div v-else class="text-center py-12 text-muted-foreground">Track not found.</div>
  </div>
</template>
