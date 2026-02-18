<script setup lang="ts">
import Card from '~/components/ui/card.vue'
import { useAsync } from '~/composables/useAsync'

const api = useApi()
const { data: tracks, isLoading, execute } = useAsync(() => api.tracks.getAll())

onMounted(() => {
  execute()
})
</script>

<template>
  <div class="container py-12">
    <div class="max-w-4xl mx-auto">
      <h1 class="text-3xl font-bold mb-2">Learning Tracks</h1>
      <p class="text-muted-foreground mb-8">
        Choose a track to start practicing code completion exercises.
      </p>

      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <div class="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>

      <div v-else-if="tracks" class="grid gap-4">
        <NuxtLink
          v-for="track in tracks"
          :key="track.id"
          :to="`/tracks/${track.slug}`"
        >
          <Card class="hover:border-primary/50 transition-colors cursor-pointer">
            <div class="flex items-center gap-4">
              <div
                v-if="track.iconUrl"
                class="w-12 h-12 rounded-lg bg-muted flex items-center justify-center"
              >
                <img :src="track.iconUrl" :alt="track.name" class="w-8 h-8" />
              </div>
              <div
                v-else
                class="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-lg"
              >
                {{ track.name.charAt(0) }}
              </div>
              <div class="flex-1">
                <h2 class="font-semibold">{{ track.name }}</h2>
                <p class="text-sm text-muted-foreground">{{ track.description }}</p>
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
        </NuxtLink>
      </div>

      <div v-else class="text-center py-12 text-muted-foreground">
        No tracks available yet.
      </div>
    </div>
  </div>
</template>
