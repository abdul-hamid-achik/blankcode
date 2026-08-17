<script setup lang="ts">
import { computed } from 'vue'
import { AUTH_COOKIE_OPTIONS } from '~/utils/auth-cookie'

/**
 * Your drills, newest first.
 *
 * The same ledger register as the reading index — dense rows, mono meta, one
 * click to the thing — because a drill is practice like any other and should
 * not arrive dressed as a novelty.
 *
 * Private, unlike that list: there is no signed-out version of a page whose
 * every row was generated from one person's failures, so this one is behind
 * auth and fetches with the session rather than around it.
 */

definePageMeta({ requiresAuth: true, middleware: 'auth' })

interface DrillRow {
  id: string
  title: string
  description: string
  conceptSlug: string
  trackSlug: string
  language: string
  source: { failedShare: number; attempts: number; window: string }
  attempts: number
  solvedAt: string | null
  createdAt: string
}

function headers(): Record<string, string> {
  const token = useCookie<string | null>('token', AUTH_COOKIE_OPTIONS).value
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const { data, pending } = await useAsyncData('drills-index', async () => {
  try {
    const result = await $fetch<{ drills: DrillRow[] }>('/api/drills', { headers: headers() })
    return { loadFailed: false, drills: result.drills }
  } catch {
    return { loadFailed: true, drills: [] as DrillRow[] }
  }
})

const drills = computed(() => data.value?.drills ?? [])
const loadFailed = computed(() => data.value?.loadFailed ?? false)
const solved = computed(() => drills.value.filter((drill) => drill.solvedAt !== null).length)

function conceptName(slug: string): string {
  return slug.replaceAll('-', ' ')
}

useSeoMeta({
  title: 'Your drills — BlankCode',
  description: 'Practice generated from your own weak spots, verified by running it.',
})
</script>

<template>
  <div class="container max-w-3xl py-10 md:py-14">
    <p class="eyebrow mb-2">drills</p>
    <h1 class="display text-2xl md:text-3xl mb-3">Practice made from where you keep failing.</h1>
    <p class="mb-4 max-w-xl leading-relaxed text-muted-foreground">
      Each of these was written for one concept you have been getting wrong, then run in the same
      sandbox as everything else. A drill you cannot see is a drill that failed its own tests.
    </p>
    <p v-if="drills.length > 0" class="mb-10 font-mono text-xs text-muted-foreground">
      {{ drills.length }} {{ drills.length === 1 ? 'drill' : 'drills' }} · {{ solved }} solved
    </p>

    <p v-if="loadFailed" class="mb-8 border-l-2 border-fail bg-fail/5 py-2 pl-3 text-sm">
      Your data could not be loaded just now — this is not what your account looks like. Refresh to
      try again.
    </p>

    <div v-if="pending" role="status">
      <div class="h-8 w-64 animate-pulse rounded bg-muted" aria-hidden="true" />
      <span class="sr-only">Loading your drills…</span>
    </div>

    <ol v-else-if="drills.length > 0" class="border border-rule">
      <li v-for="drill in drills" :key="drill.id" class="border-b border-rule last:border-b-0">
        <NuxtLink
          :to="`/drills/${drill.id}`"
          class="group block px-4 py-3.5 transition-colors hover:bg-muted/60"
        >
          <div class="flex items-baseline justify-between gap-4">
            <p class="display text-base transition-colors group-hover:text-signal">
              {{ drill.title }}
            </p>
            <p
              class="shrink-0 font-mono text-xs"
              :class="drill.solvedAt ? 'text-pass' : 'text-muted-foreground'"
            >
              <template v-if="drill.solvedAt">solved &#10003;</template>
              <template v-else-if="drill.attempts > 0">attempts {{ drill.attempts }}</template>
              <template v-else>unattempted</template>
            </p>
          </div>
          <p class="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {{ drill.description }}
          </p>
          <p class="mt-1.5 font-mono text-xs text-muted-foreground">
            {{ conceptName(drill.conceptSlug) }} · {{ drill.trackSlug }} ·
            {{ Math.round(drill.source.failedShare * 100) }}% failed
          </p>
        </NuxtLink>
      </li>
    </ol>

    <div v-else-if="!loadFailed" class="border border-rule p-6">
      <p class="mb-2">You have no drills yet.</p>
      <p class="mb-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
        A drill is generated on request from one concept you keep failing: your last 30 days of
        attempts go to a model, which writes a small exercise with two to four blanks, and the
        solution is run against its own tests in the sandbox before you are shown anything. Nothing
        that fails is saved, so there is no such thing as a broken drill here — only a generation
        that did not happen.
      </p>
      <p class="text-sm leading-relaxed text-muted-foreground">
        The dashboard names the concepts worth drilling —
        <NuxtLink to="/dashboard" class="underline hover:text-foreground"
          >look under "where it hurts"</NuxtLink
        >
        and pick one. If nothing is listed there yet, there is not enough evidence to aim at:
        <NuxtLink to="/tracks" class="underline hover:text-foreground">practise first</NuxtLink>.
      </p>
    </div>
  </div>
</template>
