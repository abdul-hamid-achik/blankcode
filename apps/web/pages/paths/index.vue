<script setup lang="ts">
import { LEARNING_PATHS } from '@blankcode/shared'
import { computed, onMounted, ref } from 'vue'
import Card from '~/components/ui/card.vue'
import { usePageSeo } from '~/composables/usePageSeo'
import { useAuthStore } from '~/stores/auth'

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
  <div class="min-h-screen">
    <!-- Hero Section -->
    <div class="border-b border-rule">
      <div class="container py-16">
        <div class="max-w-3xl">
          <div class="eyebrow mb-4 inline-flex items-center gap-2">
            <span>🗺️</span>
            <span>Guided Learning</span>
          </div>
          <h1 class="display text-2xl md:text-3xl mb-4">Learning Paths</h1>
          <p class="text-lg text-muted-foreground mb-6">
            Curated challenge sequences to master specific skills. Follow a path from start to
            finish and become an expert.
          </p>
          <div class="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>{{ sortedPaths.length }} learning paths</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-green-500"></span>
              <span>Step-by-step progression</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-purple-500"></span>
              <span>Progress tracked per exercise</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="container py-8">
      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <div
          class="animate-spin h-6 w-6 border-2 border-rule-strong border-t-signal rounded-full"
        ></div>
      </div>

      <div v-else class="grid gap-6 md:grid-cols-2">
        <NuxtLink
          v-for="path in sortedPaths"
          :key="path.id"
          :to="`/paths/${path.slug}`"
          class="group"
        >
          <Card
            class="hover:border-rule-strong hover:shadow-xl transition-all cursor-pointer h-full overflow-hidden"
          >
            <div class="h-2" :style="{ backgroundColor: path.color }"></div>
            <div class="p-6">
              <div class="flex items-start justify-between mb-4">
                <div class="text-4xl">{{ path.icon }}</div>
                <span
                  class="text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground"
                >
                  {{ path.challengeIds.length }} challenges
                </span>
              </div>

              <h3 class="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
                {{ path.name }}
              </h3>

              <p class="text-sm text-muted-foreground mb-4 line-clamp-2">
                {{ path.description }}
              </p>

              <div class="flex items-center justify-between">
                <!-- Only rendered when it is the user's real number. -->
                <div
                  v-if="getProgress(path)"
                  class="flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <span>📚</span>
                  <span
                    >{{ getProgress(path)?.completed }} /
                    {{ getProgress(path)?.total }} completed</span
                  >
                </div>
                <div v-else aria-hidden="true"></div>
                <div
                  class="flex items-center gap-1 text-sm font-medium"
                  :style="{ color: path.color }"
                >
                  Start Path
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
                    class="group-hover:translate-x-1 transition-transform"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </div>
              </div>
            </div>
          </Card>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
