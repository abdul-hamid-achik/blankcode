<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from '~/components/ui/button.vue'
import Card from '~/components/ui/card.vue'
import { useAsync } from '~/composables/useAsync'

definePageMeta({ requiresAuth: false })

const route = useRoute()
const router = useRouter()
const pathSlug = computed(() => route.params['pathSlug'] as string)

const api = useApi()
const { data: path, isLoading: pathLoading } = useAsync(() => api.paths.getBySlug(pathSlug.value))

const { data: exercises, isLoading: exercisesLoading } = useAsync(() => {
  if (!path.value) return []
  return Promise.all(
    path.value.challengeIds.map((id) => api.exercises.getById(id).catch(() => null))
  )
})

const isLoading = computed(() => pathLoading.value || exercisesLoading.value)

const validExercises = computed(() => {
  return (exercises.value || []).filter((e) => e !== null)
})

const progress = ref({
  completed: 0,
  total: path.value?.challengeIds.length || 0,
})

const startChallenge = () => {
  if (validExercises.value.length > 0) {
    router.push(`/exercise/${validExercises.value[0].id}`)
  }
}

const difficultyColors: Record<string, string> = {
  beginner: 'bg-green-500/10 text-green-500 border-green-500/20',
  intermediate: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  advanced: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  expert: 'bg-red-500/10 text-red-500 border-red-500/20',
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-background to-muted/20">
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <div class="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
    </div>

    <div v-else-if="!path" class="container py-12 text-center">
      <h1 class="text-2xl font-bold mb-4">Path not found</h1>
      <NuxtLink to="/paths">
        <Button>Browse All Paths</Button>
      </NuxtLink>
    </div>

    <div v-else>
      <!-- Hero Section -->
      <div class="border-b border-border" :style="{ backgroundColor: `${path.color}15` }">
        <div class="container py-12">
          <div class="max-w-4xl">
            <NuxtLink to="/paths" class="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
              &larr; Back to Paths
            </NuxtLink>
            
            <div class="flex items-start gap-4 mb-6">
              <div class="text-6xl">{{ path.icon }}</div>
              <div>
                <h1 class="text-4xl font-bold mb-2">{{ path.name }}</h1>
                <p class="text-lg text-muted-foreground mb-4">{{ path.description }}</p>
                <div class="flex items-center gap-4 text-sm text-muted-foreground">
                  <span class="flex items-center gap-1">
                    <span>📚</span>
                    {{ path.challengeIds.length }} challenges
                  </span>
                  <span class="flex items-center gap-1">
                    <span>📊</span>
                    {{ progress.completed }} / {{ progress.total }} completed
                  </span>
                </div>
              </div>
            </div>

            <Button size="lg" @click="startChallenge">
              Start Path
            </Button>
          </div>
        </div>
      </div>

      <!-- Challenges List -->
      <div class="container py-8">
        <h2 class="text-2xl font-bold mb-6">Challenges in this Path</h2>

        <div class="space-y-4">
          <NuxtLink
            v-for="(exercise, index) in validExercises"
            :key="exercise.id"
            :to="`/exercise/${exercise.id}`"
          >
            <Card class="hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer">
              <div class="p-6">
                <div class="flex items-start gap-4">
                  <!-- Step Number -->
                  <div
                    class="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg"
                    :style="{
                      backgroundColor: `${path.color}20`,
                      color: path.color,
                    }"
                  >
                    {{ index + 1 }}
                  </div>

                  <!-- Content -->
                  <div class="flex-1">
                    <div class="flex items-center gap-3 mb-2">
                      <h3 class="font-semibold text-lg">{{ exercise.title }}</h3>
                      <span
                        :class="[
                          'text-xs px-2.5 py-1 rounded-full border font-medium',
                          difficultyColors[exercise.difficulty],
                        ]"
                      >
                        {{ exercise.difficulty }}
                      </span>
                    </div>

                    <p class="text-sm text-muted-foreground mb-3">
                      {{ exercise.description }}
                    </p>

                    <div class="flex items-center gap-4 text-xs text-muted-foreground">
                      <span class="flex items-center gap-1">
                        <span>🏆</span>
                        Challenge
                      </span>
                      <span>•</span>
                      <span>{{ exercise.concept?.name || 'Unknown' }}</span>
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
