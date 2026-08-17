<script setup lang="ts">
import { LEARNING_PATHS, type Exercise, type LearningPath } from '@blankcode/shared'
import { computed, onMounted, ref } from 'vue'
import Button from '~/components/ui/button.vue'
import DifficultyTag from '~/components/ui/difficulty-tag.vue'
import { usePageSeo } from '~/composables/usePageSeo'
import { useAuthStore } from '~/stores/auth'
import {
  challengeCountLabel,
  trackLabelForExercise,
  type CatalogExercise,
} from '~/utils/challenge-catalog'
import { exerciseHref } from '~/utils/exercise-href'

definePageMeta({ requiresAuth: false })

const route = useRoute()
const pathSlug = computed(() => route.params['pathSlug'] as string)

/*
 * Learning paths are static data, so whether this slug exists is knowable
 * during the server render — no request needed. Answering 200 for one that does
 * not tells a crawler the URL is a valid page, which makes every typo an
 * indexable one.
 */
const authored = LEARNING_PATHS.find((p) => p.slug === pathSlug.value)
if (!authored) {
  throw createError({ statusCode: 404, statusMessage: 'Path not found', fatal: true })
}

const { data: page, pending: isLoading } = await useAsyncData(
  `path-${pathSlug.value}`,
  async () => {
    const path = await $fetch<LearningPath>(`/api/paths/${pathSlug.value}`)
    const rows = await Promise.all(
      path.challengeIds.map((id) => $fetch<Exercise>(`/api/exercises/${id}`).catch(() => null))
    )
    return { path, exercises: rows.filter((row): row is Exercise => row !== null) }
  }
)

const path = computed(() => page.value?.path ?? null)
const validExercises = computed(() => page.value?.exercises ?? [])

const auth = useAuthStore()
const api = useApi()
const completedIds = ref<Set<string> | null>(null)

onMounted(async () => {
  if (!auth.isAuthenticated) return
  try {
    completedIds.value = new Set(await api.progress.completed())
  } catch {
    // Show nothing rather than a wrong zero.
  }
})

const progress = computed(() => {
  if (!completedIds.value || !path.value) return null
  return {
    completed: path.value.challengeIds.filter((id) => completedIds.value?.has(id)).length,
    total: path.value.challengeIds.length,
  }
})

const isDone = (id: string) => completedIds.value?.has(id) ?? false

const startHref = computed(() => {
  const first = validExercises.value.find((e) => !isDone(e.id)) ?? validExercises.value[0]
  return first ? exerciseHref(first as CatalogExercise & { id: string; slug?: string }) : '/paths'
})

usePageSeo({
  title: `${authored.name} — BlankCode`,
  description: authored.description,
  path: `/paths/${authored.slug}`,
})
</script>

<template>
  <div class="min-h-screen">
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <div
        class="animate-spin h-6 w-6 border-2 border-rule-strong border-t-signal rounded-full"
      ></div>
    </div>

    <div v-else-if="!path" class="container py-12">
      <h1 class="display text-xl md:text-2xl mb-4">Path not found</h1>
      <Button to="/paths" variant="outline">Back to paths</Button>
    </div>

    <div v-else class="container max-w-3xl py-10 md:py-14">
      <NuxtLink
        to="/paths"
        class="mb-6 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        &larr; Back to paths
      </NuxtLink>

      <h1 class="display text-2xl md:text-3xl mb-2">{{ path.name }}</h1>
      <p class="mb-4 max-w-xl text-muted-foreground">{{ path.description }}</p>
      <p class="mb-8 font-mono text-xs text-muted-foreground">
        {{ challengeCountLabel(path.challengeIds.length) }}
        <template v-if="progress">
          · {{ progress.completed }} / {{ progress.total }} done
        </template>
      </p>

      <Button size="lg" :to="startHref">Start here</Button>

      <ol class="mt-10 border border-rule">
        <li
          v-for="(exercise, index) in validExercises"
          :key="exercise.id"
          class="border-b border-rule last:border-b-0"
        >
          <NuxtLink
            :to="exerciseHref(exercise as CatalogExercise & { id: string; slug?: string })"
            class="block px-4 py-4 transition-colors hover:bg-muted/60"
          >
            <div class="flex items-baseline justify-between gap-4">
              <h2 class="display text-base">
                <span class="font-mono text-xs text-muted-foreground">{{ index + 1 }}.</span>
                {{ exercise.title }}
                <span v-if="isDone(exercise.id)" class="ml-2 font-mono text-xs text-pass"
                  >done</span
                >
              </h2>
              <DifficultyTag :difficulty="exercise.difficulty" show-rank />
            </div>
            <p class="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {{ exercise.description }}
            </p>
            <p class="mt-1 font-mono text-xs text-muted-foreground">
              {{ trackLabelForExercise(exercise as CatalogExercise) }}
            </p>
          </NuxtLink>
        </li>
      </ol>
    </div>
  </div>
</template>
