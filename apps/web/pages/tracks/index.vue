<script setup lang="ts">
import type { Track } from '@blankcode/shared'
import { computed, onMounted } from 'vue'
import EmptyState from '~/components/error/empty-state.vue'
import { useApi } from '~/composables/useApi'
import { useAsync } from '~/composables/useAsync'
import { useAuthStore } from '~/stores/auth'
import { usePageSeo } from '~/composables/usePageSeo'
import { LANDING_TRACKS } from '~/utils/landing-tracks'

/**
 * A track row's job is to tell you where you are in it. Descriptions were
 * doing all the talking before, which meant the list looked identical whether
 * you had finished a track or never opened it.
 */

const api = useApi()
const authStore = useAuthStore()

/*
 * The track list is public, so it is fetched during the render — this page used
 * to load it on mount and served a crawler one heading and nothing else.
 *
 * The progress summary stays on mount on purpose: it needs the reader's token
 * and is different for every one of them, so there is nothing to render on the
 * server and nothing worth caching.
 */
const { data: tracks, pending: isLoading } = await useAsyncData('tracks', () =>
  $fetch<Track[]>('/api/tracks')
)

const { data: summary, execute: loadSummary } = useAsync(() => api.progress.getSummary())

onMounted(() => {
  if (authStore.isAuthenticated) loadSummary()
})

/** Progress keyed by track slug, so a row can render its own state. */
const progressBySlug = computed(() => {
  const map = new Map<string, { completed: number; total: number; mastery: number }>()
  for (const row of summary.value ?? []) {
    map.set(row.trackSlug, {
      completed: row.completedExercises,
      total: row.totalExercises,
      mastery: row.masteryLevel,
    })
  }
  return map
})

function percent(completed: number, total: number): number {
  return total > 0 ? Math.round((completed / total) * 100) : 0
}

usePageSeo({
  title: 'Tracks — BlankCode',
  description: `${LANDING_TRACKS.length} languages, from TypeScript and Python to Go and Rust. Each track is real code with the pieces that matter taken out.`,
  path: '/tracks',
})
</script>

<template>
  <div class="container max-w-3xl py-10 md:py-14">
    <p class="eyebrow mb-2">tracks</p>
    <h1 class="display text-2xl md:text-3xl mb-2">Pick where to put the reps.</h1>
    <p class="text-muted-foreground mb-10 max-w-lg">
      Each track is ordered from basics to the parts that go first when you stop using them.
    </p>

    <div v-if="isLoading" class="border border-rule" role="status">
      <div v-for="n in 4" :key="n" class="border-b border-rule px-4 py-5 last:border-b-0">
        <div class="h-3 w-32 animate-pulse rounded bg-muted" aria-hidden="true" />
      </div>
      <span class="sr-only">Loading tracks…</span>
    </div>

    <ul v-else-if="tracks?.length" class="border border-rule">
      <li v-for="track in tracks" :key="track.id" class="border-b border-rule last:border-b-0">
        <NuxtLink
          :to="`/tracks/${track.slug}`"
          class="group block px-4 py-4 transition-colors hover:bg-muted/60"
        >
          <div class="flex items-baseline justify-between gap-4">
            <h2 class="display text-base">{{ track.name }}</h2>

            <span
              v-if="progressBySlug.get(track.slug)"
              class="shrink-0 font-mono text-xs text-muted-foreground"
            >
              {{ progressBySlug.get(track.slug)!.completed }}/{{
                progressBySlug.get(track.slug)!.total
              }}
            </span>
            <span
              v-else
              class="shrink-0 font-mono text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
              aria-hidden="true"
              >&rarr;</span
            >
          </div>

          <p class="mt-1 line-clamp-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {{ track.description }}
          </p>

          <!-- The rule doubles as the progress bar: same line, more meaning. -->
          <div
            v-if="progressBySlug.get(track.slug)"
            class="mt-3 h-0.5 w-full bg-rule"
            role="img"
            :aria-label="`${percent(
              progressBySlug.get(track.slug)!.completed,
              progressBySlug.get(track.slug)!.total
            )}% complete`"
          >
            <div
              class="h-full bg-signal"
              :style="{
                width: `${percent(
                  progressBySlug.get(track.slug)!.completed,
                  progressBySlug.get(track.slug)!.total
                )}%`,
              }"
            />
          </div>
        </NuxtLink>
      </li>
    </ul>

    <EmptyState
      v-else
      eyebrow="no tracks"
      title="Nothing has been imported yet."
      description="Nothing is published yet. Come back when a track is imported, or browse the tutorials in the meantime."
    />
  </div>
</template>
