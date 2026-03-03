<script setup lang="ts">
import { computed } from 'vue'
import Card from '~/components/ui/card.vue'
import { useAsync } from '~/composables/useAsync'

definePageMeta({ requiresAuth: false })

const api = useApi()
const { data: paths, isLoading } = useAsync(() => api.paths.getAll())

const sortedPaths = computed(() => {
  if (!paths.value) return []
  return [...paths.value].sort((a, b) => a.order - b.order)
})

const getProgress = (path: any) => {
  // For now, show placeholder - will integrate with real progress later
  return { completed: 0, total: path.challengeIds.length }
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-background to-muted/20">
    <!-- Hero Section -->
    <div class="border-b border-border bg-gradient-to-r from-blue-500/10 via-purple-500/5 to-pink-500/10">
      <div class="container py-16">
        <div class="max-w-3xl">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm mb-4">
            <span>🗺️</span>
            <span>Guided Learning</span>
          </div>
          <h1 class="text-4xl md:text-5xl font-bold mb-4">
            Learning Paths
          </h1>
          <p class="text-lg text-muted-foreground mb-6">
            Curated challenge sequences to master specific skills. Follow a path from start to finish and become an expert.
          </p>
          <div class="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>{{ paths?.length || 0 }} learning paths</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-green-500"></span>
              <span>Step-by-step progression</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-purple-500"></span>
              <span>Earn completion badges</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="container py-8">
      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <div class="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>

      <div v-else class="grid gap-6 md:grid-cols-2">
        <NuxtLink
          v-for="path in sortedPaths"
          :key="path.id"
          :to="`/paths/${path.slug}`"
          class="group"
        >
          <Card class="hover:border-primary/50 hover:shadow-xl transition-all cursor-pointer h-full overflow-hidden">
            <div class="h-2" :style="{ backgroundColor: path.color }"></div>
            <div class="p-6">
              <div class="flex items-start justify-between mb-4">
                <div class="text-4xl">{{ path.icon }}</div>
                <span class="text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
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
                <div class="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>📚</span>
                  <span>{{ getProgress(path).completed }} / {{ getProgress(path).total }} completed</span>
                </div>
                <div class="flex items-center gap-1 text-sm font-medium" :style="{ color: path.color }">
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
