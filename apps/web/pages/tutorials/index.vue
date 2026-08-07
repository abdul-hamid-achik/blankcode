<script setup lang="ts">
/**
 * The shape `content.config.ts` declares for the tutorials collection, plus
 * the `path` @nuxt/content adds. Declared rather than cast at each use: the
 * twelve `as any` this replaces meant a typo in a field name was invisible.
 */
interface Tutorial {
  path: string
  title: string
  description: string
  order: number
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  tags: string[]
  track?: string
  slug?: string
}

const selectedTrack = ref<string | null>(null)

const { data: allTutorials } = await useAsyncData('tutorials', () =>
  queryCollection('tutorials').all()
)

const tutorials = computed(() => (allTutorials.value ?? []) as unknown as Tutorial[])

const byOrder = (a: Tutorial, b: Tutorial) => (a.order ?? 0) - (b.order ?? 0)

const tracks = computed(() =>
  [
    ...new Set(tutorials.value.map((t) => t.track).filter((track): track is string => !!track)),
  ].toSorted()
)

const standaloneTutorials = computed(() =>
  tutorials.value.filter((t) => !t.track).toSorted(byOrder)
)

const trackTutorials = computed(() => {
  const filtered = tutorials.value.filter((t) => t.track)
  const selected = selectedTrack.value
  return (selected ? filtered.filter((t) => t.track === selected) : filtered).toSorted(byOrder)
})

const difficultyColor: Record<string, string> = {
  beginner: 'bg-green-500/10 text-green-500',
  intermediate: 'bg-yellow-500/10 text-yellow-500',
  advanced: 'bg-red-500/10 text-red-500',
}

function getSlug(tutorial: Tutorial): string {
  // Extract slug from path: /tutorials/go/foo => go/foo or /tutorials/foo => foo
  return tutorial.path?.replace(/^\/tutorials\//, '') ?? tutorial.slug ?? ''
}
</script>

<template>
  <div class="container py-12">
    <div class="max-w-4xl mx-auto">
      <h1 class="display text-2xl md:text-3xl mb-2">Tutorials</h1>
      <p class="text-muted-foreground mb-8">
        Guides and articles to deepen your understanding of programming concepts.
      </p>

      <div class="flex flex-wrap gap-2 mb-8">
        <button
          :class="[
            'px-3 py-1.5 text-sm rounded-lg border transition-colors',
            selectedTrack === null
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-rule text-muted-foreground hover:text-foreground hover:border-foreground/30',
          ]"
          @click="selectedTrack = null"
        >
          All
        </button>
        <button
          v-for="track in tracks"
          :key="track"
          :class="[
            'px-3 py-1.5 text-sm rounded-lg border transition-colors capitalize',
            selectedTrack === track
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-rule text-muted-foreground hover:text-foreground hover:border-foreground/30',
          ]"
          @click="selectedTrack = selectedTrack === track ? null : track"
        >
          {{ track }}
        </button>
      </div>

      <div v-if="standaloneTutorials.length && !selectedTrack" class="mb-10">
        <h2 class="display text-lg mb-4">General</h2>
        <div class="grid gap-4">
          <NuxtLink
            v-for="tutorial in standaloneTutorials"
            :key="getSlug(tutorial)"
            :to="`/tutorials/${getSlug(tutorial)}`"
          >
            <div
              class="w-full rounded border border-rule bg-muted/50 p-6 hover:border-rule-strong transition-colors cursor-pointer"
            >
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <h3 class="font-semibold">{{ tutorial.title }}</h3>
                    <span
                      :class="[
                        'px-2 py-0.5 text-xs rounded-full capitalize',
                        difficultyColor[tutorial.difficulty],
                      ]"
                    >
                      {{ tutorial.difficulty }}
                    </span>
                  </div>
                  <p class="text-sm text-muted-foreground">{{ tutorial.description }}</p>
                  <div class="flex flex-wrap gap-1.5 mt-2">
                    <span
                      v-for="tag in tutorial.tags"
                      :key="tag"
                      class="px-2 py-0.5 text-xs rounded bg-muted text-muted-foreground"
                      >{{ tag }}</span
                    >
                  </div>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="text-muted-foreground shrink-0 mt-1"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </div>
            </div>
          </NuxtLink>
        </div>
      </div>

      <div v-if="trackTutorials.length">
        <h2 v-if="!selectedTrack" class="display text-lg mb-4">By Track</h2>
        <h2 v-else class="display text-lg mb-4 capitalize">{{ selectedTrack }} Tutorials</h2>
        <div class="grid gap-4">
          <NuxtLink
            v-for="tutorial in trackTutorials"
            :key="getSlug(tutorial)"
            :to="`/tutorials/${getSlug(tutorial)}`"
          >
            <div
              class="w-full rounded border border-rule bg-muted/50 p-6 hover:border-rule-strong transition-colors cursor-pointer"
            >
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <h3 class="font-semibold">{{ tutorial.title }}</h3>
                    <span
                      :class="[
                        'px-2 py-0.5 text-xs rounded-full capitalize',
                        difficultyColor[tutorial.difficulty],
                      ]"
                    >
                      {{ tutorial.difficulty }}
                    </span>
                    <span
                      v-if="!selectedTrack && tutorial.track"
                      class="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary capitalize"
                    >
                      {{ tutorial.track }}
                    </span>
                  </div>
                  <p class="text-sm text-muted-foreground">{{ tutorial.description }}</p>
                  <div class="flex flex-wrap gap-1.5 mt-2">
                    <span
                      v-for="tag in tutorial.tags"
                      :key="tag"
                      class="px-2 py-0.5 text-xs rounded bg-muted text-muted-foreground"
                      >{{ tag }}</span
                    >
                  </div>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="text-muted-foreground shrink-0 mt-1"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </div>
            </div>
          </NuxtLink>
        </div>
      </div>

      <div
        v-if="!standaloneTutorials.length && !trackTutorials.length"
        class="text-center py-12 text-muted-foreground"
      >
        No tutorials available yet.
      </div>
    </div>
  </div>
</template>
