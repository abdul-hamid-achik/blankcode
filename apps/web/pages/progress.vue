<script setup lang="ts">
import { computed, onMounted } from 'vue'
import EmptyState from '~/components/error/empty-state.vue'
import ProgressCard from '~/components/progress/progress-card.vue'
import TrackProgressCard from '~/components/progress/track-progress-card.vue'
import Button from '~/components/ui/button.vue'
import { useProgressStore } from '~/stores/progress'

definePageMeta({ requiresAuth: true, middleware: 'auth' })

const progressStore = useProgressStore()

onMounted(async () => {
  await Promise.all([progressStore.loadStats(), progressStore.loadAllTracksProgress()])
})

const totals = computed(() => {
  const tracks = progressStore.trackProgress
  return {
    completed: tracks.reduce((acc, t) => acc + t.completedExercises, 0),
    total: tracks.reduce((acc, t) => acc + t.totalExercises, 0),
  }
})

const overallPercent = computed(() =>
  totals.value.total > 0 ? Math.round((totals.value.completed / totals.value.total) * 100) : 0
)

// Presence replaced streaks here too — see the dashboard for the argument.
const stats = computed(() => [
  { label: 'completed', value: String(progressStore.totalCompleted) },
  {
    label: 'practiced',
    value: `${progressStore.presence.practiced} of last ${progressStore.presence.window} days`,
    strip: progressStore.presence.days,
  },
  { label: 'submissions', value: String(progressStore.userStats?.totalSubmissions ?? 0) },
])
</script>

<template>
  <div class="container max-w-3xl py-10 md:py-14">
    <p class="eyebrow mb-2">progress</p>
    <h1 class="display text-2xl md:text-3xl mb-10">Where the reps have gone.</h1>

    <div v-if="progressStore.isLoading" role="status">
      <div class="h-20 animate-pulse rounded border border-rule bg-muted/50" aria-hidden="true" />
      <span class="sr-only">Loading progress…</span>
    </div>

    <template v-else>
      <dl class="grid grid-cols-2 gap-px border border-rule bg-rule sm:grid-cols-3 mb-12">
        <ProgressCard
          v-for="stat in stats"
          :key="stat.label"
          :label="stat.label"
          :value="stat.value"
          :strip="stat.strip"
        />
      </dl>

      <template v-if="progressStore.trackProgress.length > 0">
        <!-- One horizontal bar reads faster than a radial dial, and it sits on
             the same rule the rest of the page uses. -->
        <section class="mb-12">
          <div class="mb-3 flex items-baseline justify-between gap-4">
            <h2 class="eyebrow">overall</h2>
            <p class="font-mono text-xs text-muted-foreground">
              {{ totals.completed }}/{{ totals.total }} · {{ overallPercent }}%
            </p>
          </div>
          <div
            class="h-1.5 w-full bg-rule"
            role="img"
            :aria-label="`${overallPercent}% of all exercises complete`"
          >
            <div class="h-full bg-signal" :style="{ width: `${overallPercent}%` }" />
          </div>
        </section>

        <section>
          <h2 class="eyebrow mb-3">by track</h2>
          <div class="grid gap-px border border-rule bg-rule sm:grid-cols-2">
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
        </section>
      </template>

      <EmptyState
        v-else
        eyebrow="nothing tracked yet"
        title="No exercise has been run on this account."
        description="Progress, mastery, and streaks all come from submissions. Finish one exercise and this page fills in."
      >
        <template #action>
          <NuxtLink to="/tracks"><Button>Browse tracks</Button></NuxtLink>
        </template>
      </EmptyState>
    </template>
  </div>
</template>
