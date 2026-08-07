<script setup lang="ts">
import type { Exercise, Submission } from '@blankcode/shared'
import { computed, onMounted } from 'vue'
import EmptyState from '~/components/error/empty-state.vue'
import Button from '~/components/ui/button.vue'
import { useAsync } from '~/composables/useAsync'
import { useAuthStore } from '~/stores/auth'
import { useProgressStore } from '~/stores/progress'
import { useReviewStore } from '~/stores/review'
import { AUTH_COOKIE_OPTIONS } from '~/utils/auth-cookie'
import { speakNextBatch } from '~/utils/review-dates'
import { getStatusLabel } from '~/utils/submission-status'

/**
 * The dashboard answers one question: what do I practise right now?
 *
 * It used to open with four stat cards that all read 0 for a new account and
 * never told you what to do next. Now the due queue is the page, the numbers
 * are a single dense strip underneath it, and history is a list you can scan.
 */

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

/**
 * When the next batch lands. The scheduler always knew; the page never said.
 * "Nothing is due" with no horizon reads as a product with nothing more to
 * give — "3 come back on Thursday" is the same fact as a calendar.
 */
const upcoming = ref<Awaited<ReturnType<typeof api.reviews.getUpcoming>> | null>(null)

interface ContinueTarget {
  next: { id: string; title: string; conceptName: string; trackName: string } | null
}

/** "Pick something new" gets to name the pick: first unfinished exercise
 * in the track the user last touched. */
const continueTarget = ref<ContinueTarget['next']>(null)

onMounted(async () => {
  loadSubmissions()
  progressStore.loadStats()
  reviewStore.loadDueCount()
  const token = useCookie<string | null>('token', AUTH_COOKIE_OPTIONS).value
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
  const [upcomingResult, continueResult] = await Promise.allSettled([
    api.reviews.getUpcoming(),
    $fetch<ContinueTarget>('/api/exercises/continue', { headers }),
  ])
  // Both lines are extra; the heading stands on its own.
  if (upcomingResult.status === 'fulfilled') upcoming.value = upcomingResult.value
  if (continueResult.status === 'fulfilled') continueTarget.value = continueResult.value.next
})

const name = computed(() => authStore.user?.displayName || authStore.user?.username || 'you')
const dueCount = computed(() => reviewStore.dueCount)
const nextBatch = computed(() => speakNextBatch(upcoming.value?.next ?? null))

/*
 * Presence replaced the streak. A daily streak contradicts the product's own
 * scheduler — SM-2 exists to say "not yet", so the obedient learner has
 * empty days by design, and a streak either punishes obeying the calendar
 * or manufactures busywork to protect a number.
 */
const stats = computed(() => [
  { label: 'completed', value: String(progressStore.totalCompleted) },
  {
    label: 'practiced',
    value: `${progressStore.presence.practiced} of last ${progressStore.presence.window} days`,
    strip: progressStore.presence.days,
  },
  {
    label: 'submissions',
    value: String(progressStore.userStats?.totalSubmissions ?? submissions.value?.length ?? 0),
  },
])

function relativeDay(iso: string): string {
  const then = new Date(iso)
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  return then.toLocaleDateString()
}

function statusTone(status: string): string {
  if (status === 'passed') return 'text-pass'
  if (status === 'failed' || status === 'error') return 'text-fail'
  return 'text-muted-foreground'
}
</script>

<template>
  <div class="container max-w-4xl py-10 md:py-14">
    <p class="eyebrow mb-2">signed in as {{ name }}</p>

    <!-- The one decision on this page, stated as a heading. -->
    <h1 v-if="dueCount > 0" class="display text-2xl md:text-3xl mb-6">
      <span class="text-signal">{{ dueCount }}</span>
      {{ dueCount === 1 ? 'exercise is' : 'exercises are' }} ready to come back.
    </h1>
    <h1 v-else class="display text-2xl md:text-3xl mb-6">Nothing is due. Pick something new.</h1>

    <!-- The calendar speaks: the schedule's next date, said out loud. -->
    <p v-if="nextBatch" class="-mt-3 mb-6 font-mono text-sm text-muted-foreground">
      {{ nextBatch }}
    </p>

    <div class="flex flex-wrap items-center gap-3 mb-12">
      <NuxtLink v-if="dueCount > 0" to="/review">
        <Button size="lg">Start review</Button>
      </NuxtLink>
      <NuxtLink v-if="dueCount === 0 && continueTarget" :to="`/exercise/${continueTarget.id}`">
        <Button size="lg">Continue: {{ continueTarget.title }}</Button>
      </NuxtLink>
      <NuxtLink to="/tracks">
        <Button :variant="dueCount > 0 || continueTarget ? 'outline' : 'primary'" size="lg"
          >Browse tracks</Button
        >
      </NuxtLink>
    </div>

    <!-- Numbers are context, not the headline. One dense strip. -->
    <dl class="grid grid-cols-2 gap-px border border-rule bg-rule sm:grid-cols-3 mb-12">
      <div v-for="stat in stats" :key="stat.label" class="bg-background px-4 py-3">
        <dt class="eyebrow">{{ stat.label }}</dt>
        <dd class="display mt-1" :class="stat.strip ? 'text-sm' : 'text-xl'">
          {{ stat.value }}
        </dd>
        <!-- Seven cells, oldest to today. Empty days are the schedule working. -->
        <div v-if="stat.strip" class="mt-2 flex gap-1" aria-hidden="true">
          <span
            v-for="(practiced, i) in stat.strip"
            :key="i"
            class="inline-block h-2 w-5 rounded-sm"
            :class="practiced ? 'bg-signal' : 'border border-rule bg-transparent'"
          />
        </div>
      </div>
    </dl>

    <div class="mb-4 flex items-center justify-between gap-4">
      <h2 class="eyebrow">recent submissions</h2>
      <NuxtLink
        to="/progress"
        class="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        all progress &rarr;
      </NuxtLink>
    </div>

    <ul v-if="submissions?.length" class="border border-rule">
      <li
        v-for="submission in submissions"
        :key="submission.id"
        class="border-b border-rule last:border-b-0"
      >
        <NuxtLink
          :to="`/exercise/${submission.exerciseId}`"
          class="flex items-baseline gap-4 px-4 py-3 transition-colors hover:bg-muted/60"
        >
          <span class="min-w-0 flex-1 truncate text-sm">
            {{ submission.exercise?.title ?? `Exercise ${submission.exerciseId.slice(0, 8)}` }}
          </span>
          <span class="shrink-0 font-mono text-xs text-muted-foreground">
            {{ relativeDay(submission.createdAt as unknown as string) }}
          </span>
          <span class="shrink-0 font-mono text-xs" :class="statusTone(submission.status)">
            {{ getStatusLabel(submission.status).toLowerCase() }}
          </span>
        </NuxtLink>
      </li>
    </ul>

    <EmptyState
      v-else
      eyebrow="no submissions yet"
      title="Your history starts with one exercise."
      description="Pick a track, fill in the blanks, run the tests. Everything you do from here shows up in this list."
    >
      <template #action>
        <NuxtLink to="/tracks"><Button>Browse tracks</Button></NuxtLink>
      </template>
    </EmptyState>
  </div>
</template>
