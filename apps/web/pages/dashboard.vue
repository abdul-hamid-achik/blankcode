<script setup lang="ts">
import type { Exercise, Submission } from '@blankcode/shared'
import Button from '~/components/ui/button.vue'
import Card from '~/components/ui/card.vue'
import { useAsync } from '~/composables/useAsync'
import { useAuthStore } from '~/stores/auth'
import { useProgressStore } from '~/stores/progress'
import { useReviewStore } from '~/stores/review'
import { getStatusClasses, getStatusLabel } from '~/utils/submission-status'

definePageMeta({ requiresAuth: true, middleware: 'auth' })

interface SubmissionWithExercise extends Submission {
  exercise?: Pick<Exercise, 'title'>
}

const authStore = useAuthStore()
const progressStore = useProgressStore()
const reviewStore = useReviewStore()

const api = useApi()
const { data: submissions, execute: loadSubmissions } = useAsync(
  () => api.submissions.getMine(10) as Promise<SubmissionWithExercise[]>
)

onMounted(() => {
  loadSubmissions()
  progressStore.loadStats()
  reviewStore.loadDueCount()
})
</script>

<template>
  <div class="container py-12">
    <div class="max-w-4xl mx-auto">
      <div class="mb-8">
        <h1 class="text-3xl font-bold mb-2">
          Welcome back, {{ authStore.user?.displayName || authStore.user?.username }}
        </h1>
        <p class="text-muted-foreground">Continue your learning journey.</p>
      </div>

      <div class="grid md:grid-cols-4 gap-6 mb-8">
        <Card>
          <div class="text-sm text-muted-foreground">Exercises Completed</div>
          <div class="text-3xl font-bold mt-1">{{ progressStore.totalCompleted }}</div>
        </Card>
        <Card>
          <div class="text-sm text-muted-foreground">Current Streak</div>
          <div class="text-3xl font-bold mt-1">{{ progressStore.currentStreak }} days</div>
        </Card>
        <Card>
          <div class="text-sm text-muted-foreground">Total Submissions</div>
          <div class="text-3xl font-bold mt-1">{{ progressStore.userStats?.totalSubmissions ?? submissions?.length ?? 0 }}</div>
        </Card>
        <NuxtLink v-if="reviewStore.dueCount > 0" to="/review">
          <Card class="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <div class="text-sm text-muted-foreground">Review Due</div>
            <div class="text-3xl font-bold mt-1">{{ reviewStore.dueCount }}</div>
            <div class="text-xs text-muted-foreground mt-1">exercises ready</div>
          </Card>
        </NuxtLink>
        <Card v-else>
          <div class="text-sm text-muted-foreground">Review Due</div>
          <div class="text-3xl font-bold mt-1">0</div>
          <div class="text-xs text-muted-foreground mt-1">all caught up!</div>
        </Card>
      </div>

      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold">Recent Submissions</h2>
        <NuxtLink to="/tracks">
          <Button variant="outline" size="sm">Browse Tracks</Button>
        </NuxtLink>
      </div>

      <div v-if="submissions?.length" class="space-y-2">
        <NuxtLink
          v-for="submission in submissions"
          :key="submission.id"
          :to="`/exercise/${submission.exerciseId}`"
        >
          <Card class="hover:border-primary/50 transition-colors cursor-pointer">
            <div class="flex items-center justify-between">
              <div>
                <div class="font-medium">
                  {{ submission.exercise?.title ?? 'Exercise ' + submission.exerciseId.slice(0, 8) }}
                </div>
                <div class="text-sm text-muted-foreground">
                  {{ new Date(submission.createdAt).toLocaleDateString() }}
                </div>
              </div>
              <span
                :class="[
                  'text-xs px-2 py-1 rounded-full',
                  getStatusClasses(submission.status).bgClass,
                ]"
              >
                {{ getStatusLabel(submission.status) }}
              </span>
            </div>
          </Card>
        </NuxtLink>
      </div>

      <Card v-else class="text-center py-8">
        <p class="text-muted-foreground mb-4">No submissions yet. Start practicing!</p>
        <NuxtLink to="/tracks">
          <Button>Browse Tracks</Button>
        </NuxtLink>
      </Card>
    </div>
  </div>
</template>
