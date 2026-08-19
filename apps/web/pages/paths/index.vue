<script setup lang="ts">
import { LEARNING_PATHS } from '@blankcode/shared'
import { computed, onMounted, ref } from 'vue'
import { usePageSeo } from '~/composables/usePageSeo'
import { useAuthStore } from '~/stores/auth'
import { challengeCountLabel } from '~/utils/challenge-catalog'

definePageMeta({ requiresAuth: false })

/*
 * Read straight from the shared constant instead of fetching.
 *
 * This page used to load in `onMounted`, so the server rendered an empty list
 * and a crawler saw a page with one heading on it. The data was never remote:
 * learning paths are a static array that both the API handler and this page can
 * import, so the request was buying nothing and costing the page its content.
 */
const sortedPaths = computed(() =>
  [...LEARNING_PATHS].filter((path) => path.isPublished).toSorted((a, b) => a.order - b.order)
)

// Kept so the template's loading branch stays valid; there is nothing to wait for.
const isLoading = computed(() => false)

/*
 * Real completion, or nothing. This used to hardcode `{ completed: 0 }` and
 * render it as if it were the user's progress — a page whose numbers are
 * invented teaches you to stop reading its numbers. Signed out, the fraction
 * simply is not shown.
 *
 * The intersection runs against the DB-backed paths, not the constant above:
 * the constant lists exercises by slug for authoring, and the importer
 * resolves those to the UUIDs that progress rows actually carry.
 */
const auth = useAuthStore()
const api = useApi()
const progressBySlug = ref<Map<string, { completed: number; total: number }> | null>(null)

onMounted(async () => {
  await auth.initialize()
  if (!auth.isAuthenticated) return
  try {
    const [dbPaths, completed] = await Promise.all([api.paths.getAll(), api.progress.completed()])
    const done = new Set(completed)
    progressBySlug.value = new Map(
      dbPaths.map((p) => [
        p.slug,
        {
          completed: p.challengeIds.filter((id) => done.has(id)).length,
          total: p.challengeIds.length,
        },
      ])
    )
  } catch {
    // Signed in but the fetch failed: show nothing rather than a wrong zero.
  }
})

const getProgress = (path: { slug: string }) => progressBySlug.value?.get(path.slug) ?? null

usePageSeo({
  title: 'Learning paths — BlankCode',
  description:
    'Curated sequences through the exercises: working with models, a language end to end, or the problems that are the same in Vue and React.',
  path: '/paths',
})
</script>

<template>
  <div class="container max-w-3xl py-10 md:py-14">
    <p class="eyebrow mb-2">paths</p>
    <h1 class="display text-2xl md:text-3xl mb-2">A ladder, not a pile.</h1>
    <p class="mb-10 max-w-lg text-muted-foreground">
      Ordered sequences through the write-the-whole-thing work, plus two that walk the model-facing
      exercises. Tracks still hold the blanks.
    </p>

    <ul v-if="!isLoading" class="border border-rule">
      <li v-for="path in sortedPaths" :key="path.id" class="border-b border-rule last:border-b-0">
        <NuxtLink
          :to="`/paths/${path.slug}`"
          class="block px-4 py-4 transition-colors hover:bg-muted/60"
        >
          <div class="flex items-baseline justify-between gap-4">
            <h2 class="display text-base">{{ path.name }}</h2>
            <span class="shrink-0 font-mono text-xs text-muted-foreground">
              <template v-if="getProgress(path)">
                {{ getProgress(path)?.completed }}/{{ getProgress(path)?.total }}
              </template>
              <template v-else>{{ challengeCountLabel(path.challengeIds.length) }}</template>
            </span>
          </div>
          <p class="mt-1 line-clamp-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {{ path.description }}
          </p>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
