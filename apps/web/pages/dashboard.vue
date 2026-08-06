<script setup lang="ts">
import type { Exercise, Submission } from '@blankcode/shared'
import { computed, onMounted } from 'vue'
import EmptyState from '~/components/error/empty-state.vue'
import Button from '~/components/ui/button.vue'
import { useAsync } from '~/composables/useAsync'
import { useAuthStore } from '~/stores/auth'
import { useProgressStore } from '~/stores/progress'
import { useReviewStore } from '~/stores/review'
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

onMounted(() => {
  loadSubmissions()
  progressStore.loadStats()
  reviewStore.loadDueCount()
})

const name = computed(() => authStore.user?.displayName || authStore.user?.username || 'you')
const dueCount = computed(() => reviewStore.dueCount)

const stats = computed(() => [
  { label: 'completed', value: String(progressStore.totalCompleted) },
  { label: 'streak', value: `${progressStore.currentStreak}d` },
  {
    label: 'submissions',
    value: String(progressStore.userStats?.totalSubmissions ?? submissions.value?.length ?? 0),
  },
  { label: 'longest streak', value: `${progressStore.userStats?.longestStreak ?? 0}d` },
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

    <div class="flex flex-wrap items-center gap-3 mb-12">
      <NuxtLink v-if="dueCount > 0" to="/review">
        <Button size="lg">Start review</Button>
      </NuxtLink>
      <NuxtLink to="/tracks">
        <Button :variant="dueCount > 0 ? 'outline' : 'primary'" size="lg">Browse tracks</Button>
      </NuxtLink>
    </div>

    <!-- Numbers are context, not the headline. One dense strip. -->
    <dl class="grid grid-cols-2 gap-px border border-rule bg-rule sm:grid-cols-4 mb-12">
      <div v-for="stat in stats" :key="stat.label" class="bg-background px-4 py-3">
        <dt class="eyebrow">{{ stat.label }}</dt>
        <dd class="display mt-1 text-xl">{{ stat.value }}</dd>
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
