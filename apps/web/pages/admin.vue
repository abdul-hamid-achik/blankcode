<script setup lang="ts">
import { computed } from 'vue'
import { AUTH_COOKIE_OPTIONS } from '~/utils/auth-cookie'

/**
 * The operator view.
 *
 * Server-rendered behind the same check the endpoint makes, so a non-admin gets
 * a 404 rather than a flash of the page followed by an error. `noindex` as
 * well: the route is not in the sitemap, but a link pasted anywhere would be
 * enough for a crawler to find it.
 */
definePageMeta({ requiresAuth: true })

useHead({
  title: 'Usage',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

interface Totals {
  users: number
  paid: number
  submissions: number
  submissions_7d: number
  passed_7d: number
}

/*
 * Fetched on the client with the token attached explicitly.
 *
 * The first version was a bare `useFetch`, which fails twice over: the
 * endpoint reads an Authorization header that nothing was sending, and during
 * SSR the internal sub-request does not carry the browser's cookies either.
 * The symptom was "Could not load usage" for the one person allowed to see it.
 */
interface Usage {
  totals: Totals | null
  daily: Array<{ day: string; submissions: number; people: number }>
  hardest: Array<{ slug: string; title: string; attempts: number; pass_rate: number }>
  ai: { explanations_7d: number; people: number } | null
  agent: {
    people_7d: number
    sessions_7d: number
    submissions_7d: number
    reflections_7d: number
    unexplained_now: number
  } | null
}

const data = ref<Usage | null>(null)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    const token = useCookie<string | null>('token', AUTH_COOKIE_OPTIONS).value
    data.value = await $fetch<Usage>('/api/admin/usage', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  } catch {
    error.value = 'Could not load usage.'
  }
})

const totals = computed(() => data.value?.totals ?? null)

/** Pass rate over the last week, or null when nobody submitted anything. */
const passRate = computed(() => {
  const t = totals.value
  if (!t || t.submissions_7d === 0) return null
  return Math.round((100 * t.passed_7d) / t.submissions_7d)
})

/** Tallest bar in the 30-day window, so the chart scales to what happened. */
const peak = computed(() => Math.max(1, ...(data.value?.daily ?? []).map((d) => d.submissions)))
</script>

<template>
  <div class="container py-10">
    <p class="eyebrow mb-2">operator</p>
    <h1 class="display text-2xl md:text-3xl mb-8">How the site is being used</h1>

    <p v-if="error" class="text-sm text-fail">Could not load usage.</p>

    <template v-else-if="totals">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-10">
        <div
          v-for="stat in [
            { label: 'accounts', value: totals.users },
            { label: 'paying', value: totals.paid },
            { label: 'submissions, all time', value: totals.submissions },
            { label: 'submissions, 7 days', value: totals.submissions_7d },
          ]"
          :key="stat.label"
          class="rounded border border-rule bg-card p-4"
        >
          <p class="display text-2xl mb-1">{{ stat.value }}</p>
          <p class="font-mono text-xs text-muted-foreground">{{ stat.label }}</p>
        </div>
      </div>

      <section class="mb-10">
        <h2 class="eyebrow mb-4">last 30 days</h2>
        <div
          v-if="data?.daily.length"
          class="flex items-end gap-1 h-32"
          role="img"
          aria-label="Daily submissions over the last thirty days"
        >
          <div
            v-for="day in data.daily"
            :key="day.day"
            class="flex-1 bg-signal/70 rounded-sm min-h-px"
            :style="{ height: `${(day.submissions / peak) * 100}%` }"
            :title="`${day.day}: ${day.submissions} submissions, ${day.people} people`"
          />
        </div>
        <p v-else class="text-sm text-muted-foreground">Nothing submitted yet.</p>
        <p v-if="passRate !== null" class="font-mono text-xs text-muted-foreground mt-3">
          {{ passRate }}% passed this week
        </p>
      </section>

      <section class="mb-10">
        <h2 class="eyebrow mb-2">hardest exercises</h2>
        <!--
          The reason this page exists. An exercise everyone fails is usually not
          hard — it is unclear, or its tests are wrong, and nothing else says so.
        -->
        <p class="text-sm text-muted-foreground mb-4 max-w-md">
          Lowest pass rate, three attempts or more. A very low number usually means the exercise is
          unclear rather than difficult.
        </p>
        <table v-if="data?.hardest.length" class="w-full text-sm">
          <thead>
            <tr class="border-b border-rule text-left">
              <th class="py-2 font-mono text-xs text-muted-foreground font-normal">exercise</th>
              <th class="py-2 font-mono text-xs text-muted-foreground font-normal text-right">
                attempts
              </th>
              <th class="py-2 font-mono text-xs text-muted-foreground font-normal text-right">
                pass
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in data.hardest" :key="row.slug" class="border-b border-rule/60">
              <td class="py-2">
                <span class="font-mono text-xs text-muted-foreground">{{ row.slug }}</span>
                <span class="block">{{ row.title }}</span>
              </td>
              <td class="py-2 text-right font-mono">{{ row.attempts }}</td>
              <td class="py-2 text-right font-mono" :class="row.pass_rate < 30 ? 'text-fail' : ''">
                {{ row.pass_rate }}%
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="text-sm text-muted-foreground">Not enough attempts yet.</p>
      </section>

      <section class="mb-10">
        <h2 class="eyebrow mb-4">agent practice, 7 days</h2>
        <!--
          The reflect loop's health at a glance: submissions without
          reflections is the tutor being used as a solver, and a growing
          unexplained count says the holds are piling up unanswered.
        -->
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div
            v-for="stat in [
              { label: 'people connected', value: data?.agent?.people_7d ?? 0 },
              { label: 'sessions', value: data?.agent?.sessions_7d ?? 0 },
              { label: 'agent submissions', value: data?.agent?.submissions_7d ?? 0 },
              { label: 'reflections recorded', value: data?.agent?.reflections_7d ?? 0 },
              { label: 'unexplained passes now', value: data?.agent?.unexplained_now ?? 0 },
            ]"
            :key="stat.label"
            class="rounded border border-rule bg-card p-4"
          >
            <p class="display text-2xl mb-1">{{ stat.value }}</p>
            <p class="font-mono text-xs text-muted-foreground">{{ stat.label }}</p>
          </div>
        </div>
      </section>

      <section>
        <h2 class="eyebrow mb-4">ai explanations, 7 days</h2>
        <p class="text-sm">
          {{ data?.ai?.explanations_7d ?? 0 }} requested by {{ data?.ai?.people ?? 0 }}
          {{ (data?.ai?.people ?? 0) === 1 ? 'person' : 'people' }}.
        </p>
        <p class="text-sm text-muted-foreground mt-2 max-w-md">
          This is the number the free-tier limit should be chosen from, once there are a couple of
          weeks of it.
        </p>
      </section>
    </template>
  </div>
</template>
