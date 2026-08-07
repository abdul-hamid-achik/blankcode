<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import EmptyState from '~/components/error/empty-state.vue'
import Button from '~/components/ui/button.vue'
import { useReviewStore } from '~/stores/review'
import { speakNextBatch } from '~/utils/review-dates'

/**
 * The due queue. Ordered, dense, and one click from the first item — this is
 * the page the daily habit runs through, so it should read like a worklist
 * rather than a gallery of cards.
 */

definePageMeta({ requiresAuth: true, middleware: 'auth' })

const reviewStore = useReviewStore()
const api = useApi()

/** The empty state's missing fact: when the next batch arrives. */
const upcoming = ref<Awaited<ReturnType<typeof api.reviews.getUpcoming>> | null>(null)
const nextBatch = computed(() => speakNextBatch(upcoming.value?.next ?? null))

onMounted(async () => {
  reviewStore.loadDueReviews()
  try {
    upcoming.value = await api.reviews.getUpcoming()
  } catch {
    // The empty state reads fine without the horizon line.
  }
})

const first = computed(() => reviewStore.dueExercises[0])

/** How long this exercise had been left alone before coming back. */
function intervalLabel(days: number): string {
  if (days <= 1) return '1 day'
  if (days < 30) return `${days} days`
  const months = Math.round(days / 30)
  return months === 1 ? '1 month' : `${months} months`
}

function lastSeen(iso: string | null | undefined): string {
  if (!iso) return 'never seen'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'seen today'
  if (days === 1) return 'seen yesterday'
  return `seen ${days}d ago`
}
</script>

<template>
  <div class="container max-w-3xl py-10 md:py-14">
    <p class="eyebrow mb-2">review</p>

    <div v-if="reviewStore.isLoading" role="status">
      <div class="h-8 w-64 animate-pulse rounded bg-muted" aria-hidden="true" />
      <span class="sr-only">Loading due reviews…</span>
    </div>

    <template v-else-if="reviewStore.dueExercises.length > 0">
      <h1 class="display text-2xl md:text-3xl mb-6">
        <span class="text-signal">{{ reviewStore.dueExercises.length }}</span>
        {{ reviewStore.dueExercises.length === 1 ? 'exercise is' : 'exercises are' }} back.
      </h1>

      <p class="text-muted-foreground mb-8 max-w-lg">
        These are due because the schedule expects you to be losing them. Work down the list —
        rating your recall after each one sets the next interval.
      </p>

      <NuxtLink v-if="first" :to="`/exercise/${first.id}`" class="mb-10 inline-block">
        <Button size="lg">Start with {{ first.title }}</Button>
      </NuxtLink>

      <ol class="border border-rule">
        <li
          v-for="(exercise, i) in reviewStore.dueExercises"
          :key="exercise.id"
          class="border-b border-rule last:border-b-0"
        >
          <NuxtLink
            :to="`/exercise/${exercise.id}`"
            class="flex items-baseline gap-4 px-4 py-3 transition-colors hover:bg-muted/60"
          >
            <span class="shrink-0 font-mono text-xs text-muted-foreground">
              {{ String(i + 1).padStart(2, '0') }}
            </span>
            <span class="min-w-0 flex-1 truncate text-sm">{{ exercise.title }}</span>
            <span class="hidden shrink-0 font-mono text-xs text-muted-foreground sm:inline">
              {{ lastSeen(exercise.schedule?.lastReviewedAt as unknown as string) }}
            </span>
            <span class="shrink-0 font-mono text-xs text-muted-foreground">
              every {{ intervalLabel(exercise.schedule?.intervalDays ?? 1) }}
            </span>
          </NuxtLink>
        </li>
      </ol>
    </template>

    <template v-else>
      <h1 class="display text-2xl md:text-3xl mb-6">Nothing is due.</h1>
      <!-- The queue concludes instead of trailing off: the next date, spoken. -->
      <p v-if="nextBatch" class="-mt-3 mb-6 font-mono text-sm text-muted-foreground">
        {{ nextBatch }}
      </p>
      <EmptyState
        eyebrow="caught up"
        title="The schedule has nothing for you today."
        description="Exercises come back when the interval says you are starting to lose them. Until then, the useful move is new material."
      >
        <template #action>
          <div class="flex flex-wrap gap-3">
            <NuxtLink to="/tracks"><Button>Browse tracks</Button></NuxtLink>
            <NuxtLink to="/challenges">
              <Button variant="outline">Try a challenge</Button>
            </NuxtLink>
          </div>
        </template>
      </EmptyState>
    </template>
  </div>
</template>
