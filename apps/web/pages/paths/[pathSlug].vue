<script setup lang="ts">
import { LEARNING_PATHS, type Exercise } from '@blankcode/shared'
import { computed, onMounted, ref } from 'vue'
import Button from '~/components/ui/button.vue'
import Card from '~/components/ui/card.vue'
import DifficultyTag from '~/components/ui/difficulty-tag.vue'
import { useAsync } from '~/composables/useAsync'
import { useAuthStore } from '~/stores/auth'
import { trackLabelForExercise, type CatalogExercise } from '~/utils/challenge-catalog'

definePageMeta({ requiresAuth: false })

const route = useRoute()
const router = useRouter()
const pathSlug = computed(() => route.params['pathSlug'] as string)

/*
 * Learning paths are static data, so whether this slug exists is knowable
 * during the server render — no request needed. Answering 200 for one that does
 * not tells a crawler the URL is a valid page, which makes every typo an
 * indexable one.
 */
if (!LEARNING_PATHS.some((p) => p.slug === pathSlug.value)) {
  throw createError({ statusCode: 404, statusMessage: 'Path not found', fatal: true })
}

const api = useApi()
const {
  data: path,
  isLoading: pathLoading,
  execute: loadPath,
} = useAsync(() => api.paths.getBySlug(pathSlug.value))

const {
  data: exercises,
  isLoading: exercisesLoading,
  execute: loadExercises,
} = useAsync(() => {
  if (!path.value) return Promise.resolve([] as (Exercise | null)[])
  return Promise.all(
    path.value.challengeIds.map((id) => api.exercises.getById(id).catch(() => null))
  )
})

/*
 * Real done-marks, or none. `progress` was a ref hardcoded to `completed: 0`
 * rendered as if it were the user's number. Now the completed-exercise list is
 * fetched when signed in, each step carries its own mark, and the fraction is
 * simply absent when there is no one to have a fraction.
 */
const auth = useAuthStore()
const completedIds = ref<Set<string> | null>(null)

// The exercise fetch reads `path.value`, so it has to run after the path
// resolves — `useAsync` never fires either of these on its own.
onMounted(async () => {
  await loadPath()
  await Promise.all([
    loadExercises(),
    (async () => {
      if (!auth.isAuthenticated) return
      try {
        completedIds.value = new Set(await api.progress.completed())
      } catch {
        // Show nothing rather than a wrong zero.
      }
    })(),
  ])
})

const isLoading = computed(() => pathLoading.value || exercisesLoading.value)

const validExercises = computed(() => {
  return (exercises.value || []).filter((e) => e !== null)
})

const progress = computed(() => {
  if (!completedIds.value || !path.value) return null
  return {
    completed: path.value.challengeIds.filter((id) => completedIds.value?.has(id)).length,
    total: path.value.challengeIds.length,
  }
})

const isDone = (id: string) => completedIds.value?.has(id) ?? false

// Start where you left off: the first step not yet completed, not step one.
const startChallenge = () => {
  const first = validExercises.value.find((e) => !isDone(e.id)) ?? validExercises.value[0]
  if (first) {
    router.push(`/exercise/${first.id}`)
  }
}
</script>

<template>
  <div class="min-h-screen">
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <div
        class="animate-spin h-6 w-6 border-2 border-rule-strong border-t-signal rounded-full"
      ></div>
    </div>

    <div v-else-if="!path" class="container py-12 text-center">
      <h1 class="display text-xl md:text-2xl mb-4">Path not found</h1>
      <NuxtLink to="/paths">
        <Button>Browse All Paths</Button>
      </NuxtLink>
    </div>

    <div v-else>
      <!-- Hero Section -->
      <div class="border-b border-rule">
        <div class="container py-12">
          <div class="max-w-4xl">
            <NuxtLink
              to="/paths"
              class="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block"
            >
              &larr; Back to Paths
            </NuxtLink>

            <div class="flex items-start gap-4 mb-6">
              <div class="text-6xl">{{ path.icon }}</div>
              <div>
                <h1 class="display text-2xl md:text-3xl mb-2">{{ path.name }}</h1>
                <p class="text-lg text-muted-foreground mb-4">{{ path.description }}</p>
                <div class="flex items-center gap-4 text-sm text-muted-foreground">
                  <span class="flex items-center gap-1">
                    <span>📚</span>
                    {{ path.challengeIds.length }} challenges
                  </span>
                  <span v-if="progress" class="flex items-center gap-1">
                    <span>📊</span>
                    {{ progress.completed }} / {{ progress.total }} completed
                  </span>
                </div>
              </div>
            </div>

            <Button size="lg" @click="startChallenge"> Start Path </Button>
          </div>
        </div>
      </div>

      <!-- Challenges List -->
      <div class="container py-8">
        <h2 class="display text-xl md:text-2xl mb-6">Challenges in this Path</h2>

        <div class="space-y-4">
          <NuxtLink
            v-for="(exercise, index) in validExercises"
            :key="exercise.id"
            :to="`/exercise/${exercise.id}`"
          >
            <Card class="hover:border-rule-strong hover:shadow-lg transition-all cursor-pointer">
              <div class="p-6">
                <div class="flex items-start gap-4">
                  <!-- Step number, or the mark that this step is behind you. -->
                  <div
                    class="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg"
                    :style="{
                      backgroundColor: `${path.color}20`,
                      color: path.color,
                    }"
                    :title="isDone(exercise.id) ? 'Completed' : undefined"
                  >
                    <span v-if="isDone(exercise.id)" aria-label="Completed">✓</span>
                    <span v-else>{{ index + 1 }}</span>
                  </div>

                  <!-- Content -->
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-3 mb-2">
                      <h3 class="display text-base">{{ exercise.title }}</h3>
                      <DifficultyTag :difficulty="exercise.difficulty" show-rank />
                    </div>

                    <p class="text-sm text-muted-foreground mb-3">
                      {{ exercise.description }}
                    </p>

                    <div
                      class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground"
                    >
                      <span>{{ exercise.type }}</span>
                      <span>•</span>
                      <span>{{ trackLabelForExercise(exercise as CatalogExercise) }}</span>
                    </div>
                  </div>

                  <!-- Arrow -->
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
                    class="text-muted-foreground flex-shrink-0 mt-2"
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
  </div>
</template>
