<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { useAsync } from '@/composables/use-async'
import { api } from '@/api'
import Card from '@/components/ui/card.vue'

const route = useRoute()
const trackSlug = computed(() => route.params.trackSlug as string)

const { data: track, isLoading, execute } = useAsync(() =>
  api.tracks.getBySlug(trackSlug.value)
)

onMounted(() => {
  execute()
})
</script>

<template>
  <div class="container py-12">
    <div v-if="isLoading" class="text-center py-12 text-muted-foreground">
      Loading track...
    </div>

    <div v-else-if="track" class="max-w-4xl mx-auto">
      <div class="mb-8">
        <RouterLink
          to="/tracks"
          class="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block"
        >
          ← Back to Tracks
        </RouterLink>
        <h1 class="text-3xl font-bold mb-2">{{ track.name }}</h1>
        <p class="text-muted-foreground">{{ track.description }}</p>
      </div>

      <h2 class="text-xl font-semibold mb-4">Concepts</h2>

      <div v-if="track.concepts?.length" class="grid gap-4">
        <RouterLink
          v-for="concept in track.concepts"
          :key="concept.id"
          :to="`/tracks/${trackSlug}/${concept.slug}`"
        >
          <Card class="hover:border-primary/50 transition-colors cursor-pointer">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-semibold">{{ concept.name }}</h3>
                <p class="text-sm text-muted-foreground">{{ concept.description }}</p>
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
                class="text-muted-foreground"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </div>
          </Card>
        </RouterLink>
      </div>

      <div v-else class="text-center py-12 text-muted-foreground">
        No concepts available yet.
      </div>
    </div>

    <div v-else class="text-center py-12 text-muted-foreground">
      Track not found.
    </div>
  </div>
</template>
