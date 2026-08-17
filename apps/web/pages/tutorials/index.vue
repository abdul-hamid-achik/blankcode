<script setup lang="ts">
import { usePageSeo } from '~/composables/usePageSeo'
import { readingMinutes } from '~/utils/blog'

/**
 * The tutorials index as a table of contents, not a card gallery.
 *
 * Each track's tutorials are an ordered series — that is what `order` in the
 * frontmatter means — so the page shows them as numbered ledgers per track,
 * the way the review queue lists work: dense rows, mono meta, one click to
 * the thing. The general essays sit on top, before you pick a language.
 */

interface Tutorial {
  path: string
  title: string
  description: string
  order: number
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  tags: string[]
  track?: string
  body: unknown
}

const { data: allTutorials } = await useAsyncData('tutorials', () =>
  queryCollection('tutorials').all()
)

const tutorials = computed(() => (allTutorials.value ?? []) as unknown as Tutorial[])
const byOrder = (a: Tutorial, b: Tutorial) => (a.order ?? 0) - (b.order ?? 0)

const standalone = computed(() => tutorials.value.filter((t) => !t.track).toSorted(byOrder))

const trackNames: Record<string, string> = {
  typescript: 'TypeScript',
  python: 'Python',
  go: 'Go',
  rust: 'Rust',
  vue: 'Vue',
  react: 'React',
}

const series = computed(() => {
  const grouped = new Map<string, Tutorial[]>()
  for (const tutorial of tutorials.value) {
    if (!tutorial.track) continue
    grouped.set(tutorial.track, [...(grouped.get(tutorial.track) ?? []), tutorial])
  }
  return [...grouped.entries()]
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([track, items]) => ({ track, items: items.toSorted(byOrder) }))
})

const minutes = (tutorial: Tutorial) => readingMinutes(tutorial.body)

usePageSeo({
  title: 'Tutorials — BlankCode',
  description:
    'Written walkthroughs of the ideas the exercises practise — each one ends where it should: at the exercises.',
  path: '/tutorials',
})
</script>

<template>
  <div class="container max-w-3xl py-10 md:py-14">
    <p class="eyebrow mb-2">tutorials</p>
    <h1 class="display text-2xl md:text-3xl mb-3">The reading behind the practice.</h1>
    <p class="mb-4 max-w-xl leading-relaxed text-muted-foreground">
      Written walkthroughs of the ideas the exercises drill — with fill-in-the-blank checkpoints
      inline, graded as you read. Each one ends where reading should: at the exercises that make it
      yours.
    </p>
    <p class="mb-3 font-mono text-xs text-muted-foreground">
      {{ tutorials.length }} walkthroughs · {{ series.length }} tracks · checkpoints graded in-page,
      free
    </p>
    <p class="mb-10 max-w-xl text-sm leading-relaxed text-muted-foreground">
      The last three of each language — reviewing generated code, the three-message budget, and
      buying context — are the same craft, written against that language's actual defects.
    </p>

    <!-- Jump list: one line, all the series. -->
    <p class="mb-10 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
      <a
        v-for="entry in series"
        :key="entry.track"
        :href="`#${entry.track}`"
        class="transition-colors hover:text-foreground"
        >{{ trackNames[entry.track] ?? entry.track }}</a
      >
    </p>

    <!-- The general essays: read these before picking a language. -->
    <section v-if="standalone.length" class="mb-12">
      <p class="eyebrow mb-3">start here</p>
      <ol class="border border-rule">
        <li
          v-for="tutorial in standalone"
          :key="tutorial.path"
          class="border-b border-rule last:border-b-0"
        >
          <NuxtLink
            :to="tutorial.path"
            class="group block px-4 py-3.5 transition-colors hover:bg-muted/60"
          >
            <div class="flex items-baseline justify-between gap-4">
              <p class="display text-base transition-colors group-hover:text-signal">
                {{ tutorial.title }}
              </p>
              <p class="shrink-0 font-mono text-xs text-muted-foreground">
                {{ tutorial.difficulty }} · {{ minutes(tutorial) }} min
              </p>
            </div>
            <p class="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {{ tutorial.description }}
            </p>
          </NuxtLink>
        </li>
      </ol>
    </section>

    <!-- One numbered series per track, in the track's own order. -->
    <section v-for="entry in series" :id="entry.track" :key="entry.track" class="mb-12">
      <div class="mb-3 flex items-baseline justify-between gap-4">
        <p class="eyebrow">{{ trackNames[entry.track] ?? entry.track }}</p>
        <NuxtLink
          :to="`/tracks/${entry.track}`"
          class="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          the exercises &#8594;
        </NuxtLink>
      </div>
      <ol class="border border-rule">
        <li
          v-for="(tutorial, i) in entry.items"
          :key="tutorial.path"
          class="border-b border-rule last:border-b-0"
        >
          <NuxtLink
            :to="tutorial.path"
            class="group flex items-baseline gap-4 px-4 py-3.5 transition-colors hover:bg-muted/60"
          >
            <span class="shrink-0 font-mono text-xs text-muted-foreground">
              {{ String(i + 1).padStart(2, '0') }}
            </span>
            <span class="min-w-0 flex-1">
              <span class="display block text-base transition-colors group-hover:text-signal">
                {{ tutorial.title }}
              </span>
              <span class="mt-1 block max-w-xl text-sm leading-relaxed text-muted-foreground">
                {{ tutorial.description }}
              </span>
            </span>
            <span class="shrink-0 font-mono text-xs text-muted-foreground">
              {{ tutorial.difficulty }} · {{ minutes(tutorial) }} min
            </span>
          </NuxtLink>
        </li>
      </ol>
    </section>
  </div>
</template>
