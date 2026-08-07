<script setup lang="ts">
import { usePageSeo } from '~/composables/usePageSeo'
import { readingMinutes } from '~/utils/blog'

/**
 * A tutorial, rendered like the blog because the blog is where the reading
 * experience already got built: the measure, `.article-body` typography,
 * highlighted code, a table of contents earned by length. This page used to
 * style its markdown with `prose` classes from a Tailwind plugin that was
 * never installed — headings rendered as body text, lists lost their
 * bullets, and the whole article read as one cramped block.
 *
 * What makes it a tutorial rather than a post: the series is the track, so
 * prev/next walk the track's tutorials in order, and the ending is practice
 * — the one thesis this product has is that reading is not practicing.
 */

interface TocLink {
  id: string
  depth: number
  text: string
}

interface TutorialDoc {
  path: string
  title: string
  description: string
  order: number
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  tags: string[]
  track?: string
  practice?: { concept: string; label: string }
  body: { toc?: { links?: TocLink[] } }
}

const route = useRoute()

const slugPath = computed(() => {
  const s = route.params['slug']
  return Array.isArray(s) ? s.join('/') : String(s ?? '')
})

const tutorialPath = computed(() => `/tutorials/${slugPath.value}`)

const { data: tutorial } = await useAsyncData(`tutorial-${slugPath.value}`, () =>
  queryCollection('tutorials').path(tutorialPath.value).first()
)

// A missing tutorial has to be a real 404. Rendering "not found" with a 200
// tells a crawler the URL is a valid page, which turns every typo into an
// indexable one — and this content is server-resolved, so the status can be
// correct here.
if (!tutorial.value) {
  throw createError({ statusCode: 404, statusMessage: 'Tutorial not found', fatal: true })
}

const doc = computed(() => tutorial.value as unknown as TutorialDoc)
const minutes = computed(() => readingMinutes(doc.value.body))

/** h2 entries only. Three or more earn a table of contents. */
const tocLinks = computed(() => (doc.value.body.toc?.links ?? []).filter((l) => l.depth === 2))

/*
 * The series is the track: prev/next walk the same track's tutorials in
 * their authored order. Standalone tutorials walk the standalone set.
 */
interface SiblingDoc {
  path: string
  title: string
  order: number
  track?: string
}

const { data: siblings } = await useAsyncData('tutorial-siblings', () =>
  queryCollection('tutorials').select('path', 'title', 'order', 'track').all()
)

const series = computed(() =>
  ((siblings.value ?? []) as unknown as SiblingDoc[])
    .filter((s) => (s.track ?? null) === (doc.value.track ?? null))
    .toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0))
)
const position = computed(() => series.value.findIndex((s) => s.path === tutorialPath.value))
const previous = computed(() => (position.value > 0 ? series.value[position.value - 1] : undefined))
const next = computed(() =>
  position.value >= 0 && position.value < series.value.length - 1
    ? series.value[position.value + 1]
    : undefined
)

const site = useSiteUrl()
const canonical = computed(() => `${site}${tutorialPath.value}`)

usePageSeo({
  title: doc.value.title,
  description: doc.value.description,
  path: tutorialPath.value,
  type: 'article',
})

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: computed(() =>
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'TechArticle',
          headline: doc.value.title,
          description: doc.value.description,
          proficiencyLevel: doc.value.difficulty,
          publisher: { '@type': 'Organization', name: 'BlankCode', url: site },
          mainEntityOfPage: { '@type': 'WebPage', '@id': canonical.value },
          keywords: doc.value.tags?.join(', '),
        })
      ),
    },
  ],
})
</script>

<template>
  <article v-if="tutorial" class="container py-12 md:py-16">
    <!-- Same reading measure as the blog: ~65ch at the article's body size. -->
    <div class="mx-auto max-w-[42rem]">
      <nav aria-label="Breadcrumb" class="mb-8">
        <NuxtLink
          to="/tutorials"
          class="eyebrow inline-block transition-colors hover:text-foreground"
        >
          &#8592; tutorials
        </NuxtLink>
      </nav>

      <header class="mb-10 border-b border-rule pb-8">
        <p class="eyebrow mb-4">
          <NuxtLink
            v-if="doc.track"
            :to="`/tracks/${doc.track}`"
            class="transition-colors hover:text-foreground"
            >{{ doc.track }}</NuxtLink
          >
          <span v-if="doc.track" aria-hidden="true"> · </span>{{ doc.difficulty
          }}<span aria-hidden="true"> · </span>{{ minutes }} min read
        </p>
        <h1 class="display text-3xl md:text-4xl leading-tight mb-4">{{ doc.title }}</h1>
        <p class="text-lg leading-relaxed text-muted-foreground">{{ doc.description }}</p>
        <p
          v-if="doc.tags?.length"
          class="mt-5 flex flex-wrap gap-x-3 font-mono text-xs text-muted-foreground/80"
        >
          <span v-for="tag in doc.tags" :key="tag">#{{ tag }}</span>
        </p>
      </header>

      <!-- Contents, when the tutorial has enough sections to need a map. -->
      <nav
        v-if="tocLinks.length >= 3"
        aria-label="Contents"
        class="mb-10 border-l-2 border-rule-strong py-1 pl-5"
      >
        <p class="eyebrow mb-3">contents</p>
        <ol class="space-y-1.5">
          <li v-for="link in tocLinks" :key="link.id">
            <a
              :href="`#${link.id}`"
              class="font-mono text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {{ link.text }}
            </a>
          </li>
        </ol>
      </nav>

      <div class="article-body">
        <ContentRenderer :value="tutorial" />
      </div>

      <!--
        The ending is practice, not navigation. A tutorial that closes with
        "Back to Tutorials" closes by contradicting the product's one thesis:
        reading is not practicing.
      -->
      <aside
        v-if="doc.practice && doc.track"
        class="mt-16 border-t border-rule-strong pt-8"
        aria-label="Practice this"
      >
        <p class="eyebrow mb-3">now practice it</p>
        <p class="max-w-[58ch] leading-relaxed text-muted-foreground">
          Reading this was the cheap half. The {{ doc.practice.label }} exercises run your code
          against a real suite — that is where it becomes yours.
        </p>
        <NuxtLink
          :to="`/tracks/${doc.track}/${doc.practice.concept}`"
          class="mt-4 inline-block font-mono text-sm text-foreground underline decoration-rule-strong underline-offset-4 transition-colors hover:decoration-foreground"
        >
          Practice this: {{ doc.practice.label }} &#8594;
        </NuxtLink>
      </aside>
      <aside v-else class="mt-16 border-t border-rule-strong pt-8" aria-label="About BlankCode">
        <p class="eyebrow mb-3">practice</p>
        <p class="max-w-[58ch] leading-relaxed text-muted-foreground">
          Everything argued here is what BlankCode does as a tool: real code with the load-bearing
          lines blanked out, scheduled to come back just before you would forget it.
        </p>
        <NuxtLink
          to="/tracks"
          class="mt-4 inline-block font-mono text-sm text-foreground underline decoration-rule-strong underline-offset-4 transition-colors hover:decoration-foreground"
        >
          Browse the tracks &#8594;
        </NuxtLink>
      </aside>

      <!-- The series continues in both directions along the track. -->
      <nav
        v-if="previous || next"
        aria-label="More in this series"
        class="mt-12 grid gap-px border-t border-rule pt-8 sm:grid-cols-2 sm:gap-8"
      >
        <NuxtLink v-if="previous" :to="previous.path" class="group block pb-6 sm:pb-0">
          <p class="eyebrow mb-2">&#8592; previous</p>
          <p class="display text-base leading-snug transition-colors group-hover:text-signal">
            {{ previous.title }}
          </p>
        </NuxtLink>
        <NuxtLink
          v-if="next"
          :to="next.path"
          class="group block sm:text-right"
          :class="{ 'sm:col-start-2': !previous }"
        >
          <p class="eyebrow mb-2">next &#8594;</p>
          <p class="display text-base leading-snug transition-colors group-hover:text-signal">
            {{ next.title }}
          </p>
        </NuxtLink>
      </nav>
    </div>
  </article>
</template>
