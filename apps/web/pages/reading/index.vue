<script setup lang="ts">
import { computed } from 'vue'
import { usePageSeo } from '~/composables/usePageSeo'
import { AUTH_COOKIE_OPTIONS } from '~/utils/auth-cookie'

/**
 * The reading ledger, in the same register as the tutorials index: dense rows,
 * mono meta, one click to the thing.
 *
 * Public and server-rendered, because the list is the argument for the form —
 * a crawler and a signed-out visitor should both be able to read what is on
 * offer. The marks in the right-hand column are the only part that needs a
 * session, and their absence narrows the page rather than gating it.
 */

definePageMeta({ requiresAuth: false })

interface ReadingRow {
  id: string
  slug: string
  title: string
  brief: string
  language: string
  difficulty: string
  fileCount: number
  attempts: number
  bestScore: number | null
  bestMaxScore: number | null
}

const { data, pending } = await useAsyncData('reading-index', () => {
  const token = useCookie<string | null>('token', AUTH_COOKIE_OPTIONS).value
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
  return $fetch<{ exercises: ReadingRow[] }>('/api/reading', { headers })
})

const exercises = computed(() => data.value?.exercises ?? [])

/**
 * Every brief opens with the same sentence — it is the instruction, not the
 * description — so the row shows what comes after it. A list where three rows
 * read identically is a list that tells you nothing.
 */
function oneLiner(brief: string): string {
  const sentences = brief.trim().split(/(?<=\.)\s+/)
  return sentences.length > 1 ? sentences.slice(1).join(' ') : brief.trim()
}

function isFullMarks(row: ReadingRow): boolean {
  return row.bestScore !== null && row.bestMaxScore !== null && row.bestScore === row.bestMaxScore
}

usePageSeo({
  title: 'Reading practice — BlankCode',
  description:
    'Read a small codebase in full, then explain what it does. The explanation is graded against an authored rubric: coverage of what actually happens, not vocabulary.',
  path: '/reading',
})
</script>

<template>
  <div class="container max-w-3xl py-10 md:py-14">
    <p class="eyebrow mb-2">reading</p>
    <h1 class="display text-2xl md:text-3xl mb-3">Read the whole thing, then say what it does.</h1>
    <p class="mb-4 max-w-xl leading-relaxed text-muted-foreground">
      A small codebase, every file of it. You read it, then explain it in prose to a teammate who
      has to modify it tomorrow. The grade is coverage: each thing a complete reading would have
      noticed, and whether you said it.
    </p>
    <p class="mb-10 font-mono text-xs text-muted-foreground">
      {{ exercises.length }} codebases · graded against an authored rubric · misses shown in full
    </p>

    <div v-if="pending" role="status">
      <div class="h-8 w-64 animate-pulse rounded bg-muted" aria-hidden="true" />
      <span class="sr-only">Loading reading exercises…</span>
    </div>

    <ol v-else-if="exercises.length > 0" class="border border-rule">
      <li v-for="row in exercises" :key="row.id" class="border-b border-rule last:border-b-0">
        <NuxtLink
          :to="`/reading/${row.slug}`"
          class="group block px-4 py-3.5 transition-colors hover:bg-muted/60"
        >
          <div class="flex items-baseline justify-between gap-4">
            <p class="display text-base transition-colors group-hover:text-signal">
              {{ row.title }}
            </p>
            <p
              v-if="row.bestScore !== null"
              class="shrink-0 font-mono text-xs"
              :class="isFullMarks(row) ? 'text-pass' : 'text-muted-foreground'"
            >
              best {{ row.bestScore }}/{{ row.bestMaxScore }}
            </p>
          </div>
          <p class="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {{ oneLiner(row.brief) }}
          </p>
          <p class="mt-1.5 font-mono text-xs text-muted-foreground">
            {{ row.language }} · {{ row.difficulty }} · {{ row.fileCount }} files<template
              v-if="row.attempts > 0"
            >
              · {{ row.attempts }} {{ row.attempts === 1 ? 'attempt' : 'attempts' }}</template
            >
          </p>
        </NuxtLink>
      </li>
    </ol>

    <div v-else class="border border-rule p-6">
      <p class="mb-2">No reading exercises are published yet.</p>
      <p class="text-sm leading-relaxed text-muted-foreground">
        The written walkthroughs are the closest thing meanwhile —
        <NuxtLink to="/tutorials" class="underline hover:text-foreground">read those</NuxtLink>, or
        go straight to
        <NuxtLink to="/tracks" class="underline hover:text-foreground">the exercises</NuxtLink>.
      </p>
    </div>
  </div>
</template>
