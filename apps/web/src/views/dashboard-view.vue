<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { api } from '@/api'
import Button from '@/components/ui/button.vue'
import Card from '@/components/ui/card.vue'
import { useAsync } from '@/composables/use-async'
import { useAuthStore } from '@/stores/auth'
import { useProgressStore } from '@/stores/progress'
import { getStatusClasses, getStatusLabel } from '@/utils/submission-status'

const authStore = useAuthStore()
const progressStore = useProgressStore()

const { data: submissions, execute: loadSubmissions } = useAsync(() => api.submissions.getMine(10))

onMounted(() => {
  loadSubmissions()
  progressStore.loadStats()
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

      <div class="grid md:grid-cols-3 gap-6 mb-8">
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
      </div>

      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold">Recent Submissions</h2>
        <RouterLink to="/tracks">
          <Button variant="outline" size="sm">Browse Tracks</Button>
        </RouterLink>
      </div>

      <div v-if="submissions?.length" class="space-y-2">
        <RouterLink
          v-for="submission in submissions"
          :key="submission.id"
          :to="`/exercise/${submission.exerciseId}`"
        >
          <Card class="hover:border-primary/50 transition-colors cursor-pointer">
            <div class="flex items-center justify-between">
              <div>
                <div class="font-medium">
                  {{ (submission as any).exercise?.title ?? 'Exercise ' + submission.exerciseId.slice(0, 8) }}
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
        </RouterLink>
      </div>

      <Card v-else class="text-center py-8">
        <p class="text-muted-foreground mb-4">No submissions yet. Start practicing!</p>
        <RouterLink to="/tracks">
          <Button>Browse Tracks</Button>
        </RouterLink>
      </Card>
    </div>
  </div>
</template>
