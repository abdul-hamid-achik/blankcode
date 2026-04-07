<script setup lang="ts">
import Button from '~/components/ui/button.vue'
import Card from '~/components/ui/card.vue'
import { useReviewStore } from '~/stores/review'

definePageMeta({ requiresAuth: true, middleware: 'auth' })

const reviewStore = useReviewStore()

onMounted(() => {
  reviewStore.loadDueReviews()
})

function formatInterval(days: number): string {
  if (days === 1) return 'Day 1'
  if (days < 7) return `Day ${days}`
  if (days < 30) return `Week ${Math.floor(days / 7)}`
  return `Month ${Math.floor(days / 30)}`
}
</script>

<template>
  <div class="container py-12">
    <div class="max-w-2xl mx-auto">
      <div class="mb-8 flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold mb-2">Review</h1>
          <p class="text-muted-foreground">
            {{ reviewStore.dueCount }} exercise{{ reviewStore.dueCount !== 1 ? 's' : '' }} ready for review
          </p>
        </div>
        <NuxtLink v-if="reviewStore.dueCount > 0" to="/tracks">
          <Button variant="outline">Browse Tracks</Button>
        </NuxtLink>
      </div>

      <div v-if="reviewStore.isLoading" class="text-center py-12">
        <p class="text-muted-foreground">Loading...</p>
      </div>

      <div v-else-if="reviewStore.dueExercises.length === 0" class="text-center py-12">
        <div class="text-4xl mb-4">🎉</div>
        <h2 class="text-xl font-semibold mb-2">You're all caught up!</h2>
        <p class="text-muted-foreground mb-6">Come back tomorrow for more reviews.</p>
        <NuxtLink to="/dashboard">
          <Button>Back to Dashboard</Button>
        </NuxtLink>
      </div>

      <div v-else class="space-y-4">
        <NuxtLink
          v-for="exercise in reviewStore.dueExercises"
          :key="exercise.id"
          :to="`/exercise/${exercise.id}`"
        >
          <Card class="hover:border-primary/50 transition-colors cursor-pointer">
            <div class="flex items-center justify-between">
              <div>
                <div class="font-medium">{{ exercise.title }}</div>
                <div class="text-sm text-muted-foreground">
                  {{ exercise.concept?.track?.name }} / {{ exercise.concept?.name }}
                </div>
                <div class="text-sm text-muted-foreground mt-1">
                  <span v-if="exercise.schedule?.lastReviewedAt">
                    Last reviewed: {{ new Date(exercise.schedule.lastReviewedAt).toLocaleDateString() }}
                  </span>
                  <span v-else>Never reviewed</span>
                  <span class="mx-2">·</span>
                  <span>Reviewing: {{ formatInterval(exercise.schedule?.intervalDays ?? 1) }}</span>
                </div>
              </div>
              <Button size="sm">Start Review</Button>
            </div>
          </Card>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
