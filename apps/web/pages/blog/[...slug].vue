<script setup lang="ts">
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

const site = useSiteUrl()
const meta = computed(() => post.value as unknown as Record<string, string & string[]>)
const canonical = computed(() => `${site}${postPath.value}`)

useSeoMeta({
  title: () => meta.value['title'],
  description: () => meta.value['description'],
  ogTitle: () => meta.value['title'],
  ogDescription: () => meta.value['ogDescription'] || meta.value['description'],
  ogType: 'article',
  ogUrl: () => canonical.value,
  articlePublishedTime: () => meta.value['date'],
  articleAuthor: () => [String(meta.value['author'] ?? 'BlankCode')],
  twitterCard: 'summary_large_image',
  twitterTitle: () => meta.value['title'],
  twitterDescription: () => meta.value['ogDescription'] || meta.value['description'],
})

// Article structured data, so search results can show the date and author
// rather than guessing them out of the page text.
useHead({
  link: [{ rel: 'canonical', href: canonical }],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: computed(() =>
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: meta.value['title'],
          description: meta.value['description'],
          datePublished: meta.value['date'],
          author: { '@type': 'Organization', name: meta.value['author'] },
          publisher: { '@type': 'Organization', name: 'BlankCode', url: site },
          mainEntityOfPage: { '@type': 'WebPage', '@id': canonical.value },
          keywords: (meta.value['tags'] as unknown as string[] | undefined)?.join(', '),
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
  <article v-if="post" class="container py-12">
    <div class="max-w-2xl mx-auto">
      <NuxtLink
        to="/blog"
        class="text-sm text-muted-foreground hover:text-foreground mb-6 inline-block"
      >
        &#8592; Back to the blog
      </NuxtLink>

      <header class="mb-10">
        <h1 class="display text-2xl md:text-3xl mb-3">{{ (post as any).title }}</h1>
        <p class="text-muted-foreground mb-4">{{ (post as any).description }}</p>
        <div class="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <time :datetime="(post as any).date">{{ formatDate((post as any).date) }}</time>
          <span
            v-for="tag in (post as any).tags"
            :key="tag"
            class="px-2 py-0.5 rounded-full bg-accent text-accent-foreground"
          >
            {{ tag }}
          </span>
        </div>
      </header>

      <div
        class="prose prose-invert max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-a:text-primary hover:prose-a:text-primary/80 prose-code:text-primary prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-muted prose-pre:border prose-pre:border-rule prose-li:text-muted-foreground prose-ul:text-muted-foreground prose-ol:text-muted-foreground"
      >
        <ContentRenderer :value="post" />
      </div>
    </div>
  </article>
</template>
