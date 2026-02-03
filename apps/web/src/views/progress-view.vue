<script setup lang="ts">
import { onMounted } from 'vue'
import { useProgressStore } from '@/stores/progress'
import ProgressCard from '@/components/progress/progress-card.vue'
import TrackProgressCard from '@/components/progress/track-progress-card.vue'
import RadialProgress from '@/components/charts/radial-progress.vue'
import EmptyState from '@/components/error/empty-state.vue'

const progressStore = useProgressStore()

onMounted(async () => {
  await Promise.all([
    progressStore.loadStats(),
    progressStore.loadAllTracksProgress(),
  ])
})
</script>

<template>
  <div class="container py-12">
    <div class="max-w-4xl mx-auto">
      <h1 class="text-3xl font-bold mb-8">Your Progress</h1>

      <div v-if="progressStore.isLoading" class="text-center py-12 text-muted-foreground">
        Loading progress...
      </div>

      <template v-else>
        <!-- Stats Overview -->
        <div class="grid md:grid-cols-4 gap-6 mb-12">
          <ProgressCard
            label="Exercises Completed"
            :value="progressStore.totalCompleted"
          />
          <ProgressCard
            label="Current Streak"
            :value="`${progressStore.currentStreak} days`"
          />
          <ProgressCard
            label="Longest Streak"
            :value="`${progressStore.userStats?.longestStreak ?? 0} days`"
          />
          <ProgressCard
            label="Total Submissions"
            :value="progressStore.userStats?.totalSubmissions ?? 0"
          />
        </div>

        <!-- Overall Progress Chart -->
        <div class="mb-12">
          <h2 class="text-xl font-semibold mb-6">Overall Mastery</h2>
          <div class="flex items-center justify-center p-8 rounded-xl border border-border bg-card">
            <RadialProgress
              v-if="progressStore.trackProgress.length > 0"
              :value="progressStore.trackProgress.reduce((acc, t) => acc + t.completedExercises, 0)"
              :max="progressStore.trackProgress.reduce((acc, t) => acc + t.totalExercises, 0)"
              :size="180"
              :stroke-width="12"
            >
              <div class="text-center">
                <div class="text-3xl font-bold">
                  {{ progressStore.trackProgress.reduce((acc, t) => acc + t.completedExercises, 0) }}
                </div>
                <div class="text-sm text-muted-foreground">exercises</div>
              </div>
            </RadialProgress>
            <div v-else class="text-muted-foreground">
              No progress yet
            </div>
          </div>
        </div>

        <!-- Track Progress -->
        <div>
          <h2 class="text-xl font-semibold mb-6">Progress by Track</h2>
          <div
            v-if="progressStore.trackProgress.length > 0"
            class="grid md:grid-cols-2 gap-4"
          >
            <TrackProgressCard
              v-for="track in progressStore.trackProgress"
              :key="track.trackSlug"
              :track-slug="track.trackSlug"
              :track-name="track.trackName"
              :total-exercises="track.totalExercises"
              :completed-exercises="track.completedExercises"
              :mastery-level="track.masteryLevel"
            />
          </div>
          <EmptyState
            v-else
            title="No tracks started"
            description="Start learning a track to see your progress here."
          />
        </div>
      </template>
    </div>
  </div>
</template>
