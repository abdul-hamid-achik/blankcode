<script setup lang="ts">
import { allTutorials } from 'content-collections'
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import Card from '@/components/ui/card.vue'

const selectedTrack = ref<string | null>(null)

const tracks = computed(() => {
  const trackSet = new Set<string>()
  for (const t of allTutorials) {
    if (t.track) trackSet.add(t.track)
  }
  return Array.from(trackSet).sort()
})

const standaloneTutorials = computed(() =>
  allTutorials.filter((t) => !t.track).sort((a, b) => a.order - b.order)
)

const trackTutorials = computed(() => {
  const filtered = allTutorials.filter((t) => t.track)
  if (selectedTrack.value) {
    return filtered.filter((t) => t.track === selectedTrack.value).sort((a, b) => a.order - b.order)
  }
  return filtered.sort((a, b) => a.order - b.order)
})

const difficultyColor: Record<string, string> = {
  beginner: 'bg-green-500/10 text-green-500',
  intermediate: 'bg-yellow-500/10 text-yellow-500',
  advanced: 'bg-red-500/10 text-red-500',
}
</script>

<template>
  <div class="container py-12">
    <div class="max-w-4xl mx-auto">
      <h1 class="text-3xl font-bold mb-2">Tutorials</h1>
      <p class="text-muted-foreground mb-8">
        Guides and articles to deepen your understanding of programming concepts.
      </p>

      <!-- Track filter -->
      <div class="flex flex-wrap gap-2 mb-8">
        <button
          :class="[
            'px-3 py-1.5 text-sm rounded-lg border transition-colors',
            selectedTrack === null
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
          ]"
          @click="selectedTrack = null"
        >
          All
        </button>
        <button
          v-for="track in tracks"
          :key="track"
          :class="[
            'px-3 py-1.5 text-sm rounded-lg border transition-colors capitalize',
            selectedTrack === track
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
          ]"
          @click="selectedTrack = selectedTrack === track ? null : track"
        >
          {{ track }}
        </button>
      </div>

      <!-- Standalone tutorials -->
      <div v-if="standaloneTutorials.length && !selectedTrack" class="mb-10">
        <h2 class="text-xl font-semibold mb-4">General</h2>
        <div class="grid gap-4">
          <RouterLink
            v-for="tutorial in standaloneTutorials"
            :key="tutorial.slug"
            :to="`/tutorials/${tutorial.slug}`"
          >
            <Card class="hover:border-primary/50 transition-colors cursor-pointer">
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <h3 class="font-semibold">{{ tutorial.title }}</h3>
                    <span
                      :class="[
                        'px-2 py-0.5 text-xs rounded-full capitalize',
                        difficultyColor[tutorial.difficulty],
                      ]"
                    >
                      {{ tutorial.difficulty }}
                    </span>
                  </div>
                  <p class="text-sm text-muted-foreground">{{ tutorial.description }}</p>
                  <div class="flex flex-wrap gap-1.5 mt-2">
                    <span
                      v-for="tag in tutorial.tags"
                      :key="tag"
                      class="px-2 py-0.5 text-xs rounded bg-muted text-muted-foreground"
                    >
                      {{ tag }}
                    </span>
                  </div>
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
                  class="text-muted-foreground shrink-0 mt-1"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </div>
            </Card>
          </RouterLink>
        </div>
      </div>

      <!-- Track tutorials -->
      <div v-if="trackTutorials.length">
        <h2 v-if="!selectedTrack" class="text-xl font-semibold mb-4">By Track</h2>
        <h2 v-else class="text-xl font-semibold mb-4 capitalize">{{ selectedTrack }} Tutorials</h2>
        <div class="grid gap-4">
          <RouterLink
            v-for="tutorial in trackTutorials"
            :key="tutorial.slug"
            :to="`/tutorials/${tutorial.slug}`"
          >
            <Card class="hover:border-primary/50 transition-colors cursor-pointer">
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <h3 class="font-semibold">{{ tutorial.title }}</h3>
                    <span
                      :class="[
                        'px-2 py-0.5 text-xs rounded-full capitalize',
                        difficultyColor[tutorial.difficulty],
                      ]"
                    >
                      {{ tutorial.difficulty }}
                    </span>
                    <span
                      v-if="!selectedTrack && tutorial.track"
                      class="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary capitalize"
                    >
                      {{ tutorial.track }}
                    </span>
                  </div>
                  <p class="text-sm text-muted-foreground">{{ tutorial.description }}</p>
                  <div class="flex flex-wrap gap-1.5 mt-2">
                    <span
                      v-for="tag in tutorial.tags"
                      :key="tag"
                      class="px-2 py-0.5 text-xs rounded bg-muted text-muted-foreground"
                    >
                      {{ tag }}
                    </span>
                  </div>
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
                  class="text-muted-foreground shrink-0 mt-1"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </div>
            </Card>
          </RouterLink>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-if="!standaloneTutorials.length && !trackTutorials.length"
        class="text-center py-12 text-muted-foreground"
      >
        No tutorials available yet.
      </div>
    </div>
  </div>
</template>
