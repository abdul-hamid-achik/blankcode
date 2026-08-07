<script setup lang="ts">
import { usePageSeo } from '~/composables/usePageSeo'
import { readingMinutes, sortPostsNewestFirst } from '~/utils/blog'

interface TocLink {
  id: string
  depth: number
  text: string
}

interface PostDoc {
  path: string
  title: string
  description: string
  date: string
  author: string
  tags: string[]
  ogDescription?: string
  body: { toc?: { links?: TocLink[] } }
}

interface SiblingPost {
  path: string
  title: string
  date: string
  draft: boolean
}

const route = useRoute()

const slugPath = computed(() => {
  const s = route.params['slug']
  return Array.isArray(s) ? s.join('/') : String(s ?? '')
})

const postPath = computed(() => `/blog/${slugPath.value}`)

const { data: post } = await useAsyncData(`blog-${slugPath.value}`, () =>
  queryCollection('blog').path(postPath.value).first()
)

// A missing post has to be a real 404, not a blank page rendering 200 — an
// indexable empty page is worse than no page.
if (!post.value) {
  throw createError({ statusCode: 404, statusMessage: 'Post not found', fatal: true })
}

// The whole published list, for prev/next. Fetched with the same ordering the
// index uses, so walking "older" from the newest post visits every post in
// the order the index shows them.
const { data: siblings } = await useAsyncData('blog-siblings', () =>
  queryCollection('blog').select('path', 'title', 'date', 'draft').all()
)

const doc = computed(() => post.value as unknown as PostDoc)
const site = useSiteUrl()
const canonical = computed(() => `${site}${postPath.value}`)

const minutes = computed(() => readingMinutes(doc.value.body))

/** h2 entries only. Three or more earn a table of contents. */
const tocLinks = computed(() =>
  (doc.value.body.toc?.links ?? []).filter((link) => link.depth === 2)
)

const ordered = computed(() =>
  sortPostsNewestFirst(((siblings.value ?? []) as unknown as SiblingPost[]).filter((p) => !p.draft))
)
const position = computed(() => ordered.value.findIndex((p) => p.path === postPath.value))
const newer = computed(() => (position.value > 0 ? ordered.value[position.value - 1] : undefined))
const older = computed(() =>
  position.value >= 0 && position.value < ordered.value.length - 1
    ? ordered.value[position.value + 1]
    : undefined
)

usePageSeo({
  title: doc.value.title,
  description: doc.value.description,
  path: postPath.value,
  type: 'article',
  ogDescription: doc.value.ogDescription || undefined,
  publishedTime: doc.value.date,
  author: doc.value.author || 'BlankCode',
})

// Article structured data, so search results can show the date and author
// rather than guessing them out of the page text.
useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: computed(() =>
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: doc.value.title,
          description: doc.value.description,
          datePublished: doc.value.date,
          author: { '@type': 'Organization', name: doc.value.author },
          publisher: { '@type': 'Organization', name: 'BlankCode', url: site },
          mainEntityOfPage: { '@type': 'WebPage', '@id': canonical.value },
          keywords: doc.value.tags?.join(', '),
        })
      ),
    },
  ],
})

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
</script>

<template>
  <article v-if="post" class="container py-12 md:py-16">
    <!-- 42rem ≈ 65ch at the article's 17px body size: the reading measure. -->
    <div class="mx-auto max-w-[42rem]">
      <nav aria-label="Breadcrumb" class="mb-8">
        <NuxtLink to="/blog" class="eyebrow inline-block transition-colors hover:text-foreground">
          &#8592; blog
        </NuxtLink>
      </nav>

      <header class="mb-10 border-b border-rule pb-8">
        <p class="eyebrow mb-4">
          <time :datetime="doc.date">{{ formatDate(doc.date) }}</time>
          <span aria-hidden="true"> · </span>{{ minutes }} min read
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

      <!-- Contents, when the post has enough sections to need a map. -->
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
        <ContentRenderer :value="post" />
      </div>

      <!-- What this site is, stated once, at the point where a reader who
           arrived from a search engine has just finished the argument. -->
      <aside class="mt-16 border-t border-rule-strong pt-8" aria-label="About BlankCode">
        <p class="eyebrow mb-3">practice</p>
        <p class="max-w-[58ch] leading-relaxed text-muted-foreground">
          BlankCode is this idea as a tool: real code with the load-bearing lines blanked out,
          scheduled to come back just before you would forget them.
        </p>
        <NuxtLink
          to="/tracks"
          class="mt-4 inline-block font-mono text-sm text-foreground underline decoration-rule-strong underline-offset-4 transition-colors hover:decoration-foreground"
        >
          Browse the tracks &#8594;
        </NuxtLink>
      </aside>

      <!-- Somewhere to go next, in both directions along the timeline. -->
      <nav
        v-if="newer || older"
        aria-label="More posts"
        class="mt-12 grid gap-px border-t border-rule pt-8 sm:grid-cols-2 sm:gap-8"
      >
        <NuxtLink v-if="newer" :to="newer.path" class="group block pb-6 sm:pb-0">
          <p class="eyebrow mb-2">&#8592; newer</p>
          <p class="display text-base leading-snug transition-colors group-hover:text-signal">
            {{ newer.title }}
          </p>
        </NuxtLink>
        <NuxtLink
          v-if="older"
          :to="older.path"
          class="group block sm:text-right"
          :class="{ 'sm:col-start-2': !newer }"
        >
          <p class="eyebrow mb-2">older &#8594;</p>
          <p class="display text-base leading-snug transition-colors group-hover:text-signal">
            {{ older.title }}
          </p>
        </NuxtLink>
      </nav>
    </div>
  </article>
</template>
