<script setup lang="ts">
import Card from '~/components/ui/card.vue'
import { useAsync } from '~/composables/useAsync'

const route = useRoute()
const trackSlug = computed(() => route.params['trackSlug'] as string)
const conceptSlug = computed(() => route.params['conceptSlug'] as string)

const api = useApi()
const {
  data: exercises,
  isLoading,
  execute,
} = useAsync(() => api.exercises.getByConcept(trackSlug.value, conceptSlug.value))

onMounted(() => {
  execute()
})

const difficultyColors: Record<string, string> = {
  beginner: 'bg-green-500/10 text-green-500',
  intermediate: 'bg-yellow-500/10 text-yellow-500',
  advanced: 'bg-orange-500/10 text-orange-500',
  expert: 'bg-red-500/10 text-red-500',
}
</script>

<template>
  <div class="container py-12">
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <div class="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
    </div>

    <div v-else class="max-w-4xl mx-auto">
      <div class="mb-8">
        <NuxtLink
          :to="`/tracks/${trackSlug}`"
          class="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block"
        >
          &larr; Back to Track
        </NuxtLink>
        <h1 class="text-3xl font-bold mb-2">{{ conceptSlug }}</h1>
        <p class="text-muted-foreground">Practice exercises for this concept.</p>
      </div>

      <div v-if="exercises?.length" class="grid gap-4">
        <NuxtLink
          v-for="exercise in exercises"
          :key="exercise.id"
          :to="`/exercise/${exercise.id}`"
        >
          <Card class="hover:border-primary/50 transition-colors cursor-pointer">
            <div class="flex items-center justify-between">
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <h3 class="font-semibold">{{ exercise.title }}</h3>
                  <span
                    :class="[
                      'text-xs px-2 py-0.5 rounded-full',
                      difficultyColors[exercise.difficulty],
                    ]"
                  >
                    {{ exercise.difficulty }}
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

      <div v-else-if="exercises && exercises.length === 0" class="text-center py-8 text-muted-foreground">
        No exercises available for this concept yet.
      </div>
    </div>
  </div>
</template>
