<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

interface WeakSpotConcept {
  conceptSlug: string
  conceptName: string
  trackSlug: string
  attempts: number
  failedShare: number
  completed: number
  total: number
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
</script>

<template>
  <div v-if="hasData" class="border border-rule">
    <p class="eyebrow px-4 py-3">where it hurts</p>

    <NuxtLink
      v-for="concept in concepts"
      :key="concept.conceptSlug"
      :to="`/tracks/${concept.trackSlug}/${concept.conceptSlug}`"
      class="flex items-baseline justify-between gap-4 border-t border-rule px-4 py-3 transition-colors hover:bg-muted/60"
    >
      <span>{{ concept.conceptName }}</span>
      <span class="shrink-0 font-mono text-xs text-muted-foreground">
        {{ concept.attempts }} attempts · {{ Math.round(concept.failedShare * 100) }}% failed
      </span>
    </NuxtLink>

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
