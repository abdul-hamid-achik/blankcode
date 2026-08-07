<script setup lang="ts">
import { computed, watch } from 'vue'
import EmptyState from '~/components/error/empty-state.vue'
import Button from '~/components/ui/button.vue'
import { useReviewStore } from '~/stores/review'
import { AUTH_COOKIE_OPTIONS } from '~/utils/auth-cookie'
import { speakNextBatch } from '~/utils/review-dates'

/**
 * The due queue. Ordered, dense, and one click from the first item — this is
 * the page the daily habit runs through, so it should read like a worklist
 * rather than a gallery of cards.
 */

definePageMeta({ requiresAuth: true, middleware: 'auth' })

const reviewStore = useReviewStore()

interface ContinueTarget {
  next: { id: string; title: string; conceptName: string; trackName: string } | null
}

/*
 * The queue, the horizon, and the fallback, fetched in parallel inside one
 * useAsyncData — on the server these are in-process calls, so the worklist
 * arrives in the first paint instead of behind a spinner. The store is
 * hydrated from the result because the exercise page reads it mid-queue.
 */
const { data: page, pending } = await useAsyncData('review-queue', async () => {
  const token = useCookie<string | null>('token', AUTH_COOKIE_OPTIONS).value
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

  const [dueR, upcomingR, continueR] = await Promise.allSettled([
    $fetch<{ data?: unknown[] } | unknown[]>('/api/reviews/due', { headers }),
    $fetch<{ dueNow: number; next: { date: string; count: number } | null }>(
      '/api/reviews/upcoming',
      { headers }
    ),
    $fetch<ContinueTarget>('/api/exercises/continue', { headers }),
  ])

  const value = <T>(r: PromiseSettledResult<T>) => (r.status === 'fulfilled' ? r.value : null)
  const dueRaw = value(dueR)
  const due = Array.isArray(dueRaw) ? dueRaw : ((dueRaw as { data?: unknown[] })?.data ?? [])
  return {
    due,
    upcoming: value(upcomingR),
    continueTarget: value(continueR)?.next ?? null,
  }
})

watch(
  page,
  (result) => {
    if (!result) return
    reviewStore.dueExercises = result.due as typeof reviewStore.dueExercises
    reviewStore.dueCount = result.due.length
  },
  { immediate: true }
)

const nextBatch = computed(() => speakNextBatch(page.value?.upcoming?.next ?? null))
const continueTarget = computed(() => page.value?.continueTarget ?? null)

const first = computed(() => reviewStore.dueExercises[0])

/**
 * Backlog triage. A wall of 40 due reviews is the moment the habit dies —
 * not because the work is large but because the list refuses to say what
 * "done today" means. Past the threshold, the page names a batch (the
 * oldest first, which is the order the queue already sorts by) and says out
 * loud that the rest are postponed, not failed. The schedule is a tool, not
 * a debt collector.
 */
const TRIAGE_THRESHOLD = 15
const TRIAGE_BATCH = 10
const inTriage = computed(() => reviewStore.dueExercises.length > TRIAGE_THRESHOLD)
const showAll = ref(false)
const visibleQueue = computed(() =>
  inTriage.value && !showAll.value
    ? reviewStore.dueExercises.slice(0, TRIAGE_BATCH)
    : reviewStore.dueExercises
)
const postponedCount = computed(() => reviewStore.dueExercises.length - visibleQueue.value.length)

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

    <div v-if="pending" role="status">
      <div class="h-8 w-64 animate-pulse rounded bg-muted" aria-hidden="true" />
      <span class="sr-only">Loading due reviews…</span>
    </div>

    <template v-else-if="reviewStore.dueExercises.length > 0">
      <h1 class="display text-2xl md:text-3xl mb-6">
        <span class="text-signal">{{ reviewStore.dueExercises.length }}</span>
        {{ reviewStore.dueExercises.length === 1 ? 'exercise is' : 'exercises are' }} back.
      </h1>

      <p v-if="inTriage" class="text-muted-foreground mb-8 max-w-lg">
        That happens — the schedule kept counting while you were away. Today's plan is the
        {{ TRIAGE_BATCH }} oldest. The rest are postponed, not failed: they will still be here, and
        doing ten well beats staring at {{ reviewStore.dueExercises.length }}.
      </p>
      <p v-else class="text-muted-foreground mb-8 max-w-lg">
        These are due because the schedule expects you to be losing them. Work down the list —
        rating your recall after each one sets the next interval.
      </p>

      <NuxtLink v-if="first" :to="`/exercise/${first.id}`" class="mb-10 inline-block">
        <Button size="lg">Start with {{ first.title }}</Button>
      </NuxtLink>

      <ol class="border border-rule">
        <li
          v-for="(exercise, i) in visibleQueue"
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

      <button
        v-if="postponedCount > 0"
        class="mt-3 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
        @click="showAll = true"
      >
        and {{ postponedCount }} more, waiting — show them anyway
      </button>
    </template>

    <!-- The sitting that just ended gets its ending said. -->
    <template v-else-if="reviewStore.completedThisSession > 0">
      <h1 class="display text-2xl md:text-3xl mb-2">That's the queue.</h1>
      <p class="mb-6 font-mono text-sm text-muted-foreground">
        {{ reviewStore.completedThisSession }} reviewed today<span v-if="nextBatch">
          · {{ nextBatch }}</span
        >
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <NuxtLink v-if="continueTarget" :to="`/exercise/${continueTarget.id}`">
          <Button>Something new: {{ continueTarget.title }}</Button>
        </NuxtLink>
        <NuxtLink to="/dashboard">
          <Button :variant="continueTarget ? 'outline' : 'primary'">Done for today</Button>
        </NuxtLink>
      </div>
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
          <div class="flex flex-wrap items-center gap-3">
            <NuxtLink v-if="continueTarget" :to="`/exercise/${continueTarget.id}`">
              <Button>Continue: {{ continueTarget.title }}</Button>
            </NuxtLink>
            <NuxtLink to="/tracks">
              <Button :variant="continueTarget ? 'outline' : 'primary'">Browse tracks</Button>
            </NuxtLink>
          </div>
          <p v-if="continueTarget" class="mt-2 font-mono text-xs text-muted-foreground">
            next up in {{ continueTarget.trackName }} · {{ continueTarget.conceptName }}
          </p>
        </template>
      </EmptyState>
    </template>
  </div>
</template>
