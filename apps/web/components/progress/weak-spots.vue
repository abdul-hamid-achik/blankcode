<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { AUTH_COOKIE_OPTIONS } from '~/utils/auth-cookie'

interface WeakSpotConcept {
  conceptSlug: string
  conceptName: string
  trackSlug: string
  attempts: number
  failedShare: number
  completed: number
  total: number
  why?: 'failures' | 'unexplained'
}

interface ReadingGap {
  point: string
  misses: number
}

interface RustingConcept {
  conceptSlug: string
  conceptName: string
  trackSlug: string
  decayedMastery: number
  idleDays: number
}

interface WeakReading {
  slug: string
  title: string
  bestScore: number
  maxScore: number
}

const concepts = ref<WeakSpotConcept[]>([])
const readingGaps = ref<ReadingGap[]>([])
const rusting = ref<RustingConcept[]>([])
const weakReadings = ref<WeakReading[]>([])

// Nothing to show is the common case for a new user, and it is not an
// error — the root below stays empty rather than rendering an accusation
// with no evidence behind it.
const hasData = computed(
  () =>
    concepts.value.length > 0 ||
    readingGaps.value.length > 0 ||
    rusting.value.length > 0 ||
    weakReadings.value.length > 0
)

onMounted(async () => {
  try {
    const result = await useApi().progress.weakSpots()
    concepts.value = [...result.concepts]
    readingGaps.value = [...result.readingGaps]
    rusting.value = [...(result.rusting ?? [])]
    weakReadings.value = [...(result.weakReadings ?? [])]
  } catch {
    // Fetch failed — stays empty, same as a user with no history yet.
  }
})

/**
 * Turning a named weakness into practice, from the row that names it.
 *
 * This list has always been diagnosis without treatment: it says where it
 * hurts and links to the concept, where the exercises are the same ones that
 * were already failed. "drill this" is the other half — a drill written for
 * this concept, from these attempts, generated on the spot.
 *
 * The wait is long and worth naming honestly. Most of it is not the model: the
 * drill's own solution is run against its own tests in the sandbox, and a drill
 * that does not pass is never stored, so the seconds spent here are the reason
 * there is no such thing as a broken drill on the next page.
 */
const generatingFor = ref<string | null>(null)
const generateError = ref<{ conceptSlug: string; message: string } | null>(null)

function generateMessage(caught: unknown): string {
  const failure = caught as {
    data?: { statusMessage?: string; message?: string }
    statusMessage?: string
  }
  return (
    failure.data?.statusMessage ??
    failure.data?.message ??
    failure.statusMessage ??
    'The drill was not generated. Nothing was saved — try again.'
  )
}

async function drillThis(conceptSlug: string): Promise<void> {
  if (generatingFor.value !== null) return
  generatingFor.value = conceptSlug
  generateError.value = null

  try {
    const token = useCookie<string | null>('token', AUTH_COOKIE_OPTIONS).value
    const result = await $fetch<{ drill: { id: string } }>('/api/drills/generate', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: { conceptSlug },
    })
    await navigateTo(`/drills/${result.drill.id}`)
  } catch (caught) {
    generateError.value = { conceptSlug, message: generateMessage(caught) }
  } finally {
    generatingFor.value = null
  }
}
</script>

<template>
  <div v-if="hasData" class="border border-rule">
    <p class="eyebrow px-4 py-3">where it hurts</p>

    <div v-for="concept in concepts" :key="concept.conceptSlug" class="border-t border-rule">
      <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
        <NuxtLink
          :to="`/tracks/${concept.trackSlug}/${concept.conceptSlug}`"
          class="transition-colors hover:text-signal"
        >
          {{ concept.conceptName }}
        </NuxtLink>
        <span class="flex shrink-0 items-baseline gap-3 font-mono text-xs">
          <span class="text-muted-foreground">
            {{
              concept.why === 'unexplained'
                ? 'unexplained pass'
                : `${concept.attempts} attempts · ${Math.round(concept.failedShare * 100)}% failed`
            }}
          </span>
          <button
            type="button"
            class="text-signal transition-opacity hover:opacity-70 disabled:opacity-50"
            :disabled="generatingFor !== null"
            @click="drillThis(concept.conceptSlug)"
          >
            <template v-if="generatingFor === concept.conceptSlug">building&#8230;</template>
            <template v-else>drill this &#8594;</template>
          </button>
        </span>
      </div>

      <p
        v-if="generatingFor === concept.conceptSlug"
        class="px-4 pb-3 font-mono text-xs text-muted-foreground"
      >
        building and running your drill — it must pass its own tests before you see it
      </p>
      <p
        v-else-if="generateError?.conceptSlug === concept.conceptSlug"
        class="px-4 pb-3 font-mono text-xs text-fail"
      >
        {{ generateError.message }}
      </p>
    </div>

    <!-- Skills leaving quietly: once-held concepts whose mastery decayed. -->
    <NuxtLink
      v-for="concept in rusting"
      :key="`rust-${concept.conceptSlug}`"
      :to="`/tracks/${concept.trackSlug}/${concept.conceptSlug}`"
      class="flex items-baseline justify-between gap-4 border-t border-rule px-4 py-3 transition-colors hover:bg-muted/60"
    >
      <span>{{ concept.conceptName }}</span>
      <span class="shrink-0 font-mono text-xs text-muted-foreground">
        rusting · untouched {{ concept.idleDays }}d
      </span>
    </NuxtLink>

    <!-- Readings whose best attempt still missed too much of the rubric. -->
    <NuxtLink
      v-for="reading in weakReadings"
      :key="`read-${reading.slug}`"
      :to="`/reading/${reading.slug}`"
      class="flex items-baseline justify-between gap-4 border-t border-rule px-4 py-3 transition-colors hover:bg-muted/60"
    >
      <span>{{ reading.title }}</span>
      <span class="shrink-0 font-mono text-xs text-muted-foreground">
        best read {{ reading.bestScore }}/{{ reading.maxScore }}
      </span>
    </NuxtLink>

    <p
      v-for="gap in readingGaps"
      :key="gap.point"
      class="border-t border-rule px-4 py-3 font-mono text-xs text-muted-foreground"
    >
      keeps getting missed: {{ gap.point }} ×{{ gap.misses }}
    </p>
  </div>
</template>
