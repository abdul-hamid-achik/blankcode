<script setup lang="ts">
interface BlogPost {
  path: string
  title: string
  description: string
  date: string
  author: string
  tags: string[]
  draft: boolean
}

const { data: allPosts } = await useAsyncData('blog-index', () => queryCollection('blog').all())

// Newest first, and drafts never reach a reader.
const posts = computed(() =>
  ((allPosts.value ?? []) as unknown as BlogPost[])
    .filter((post) => !post.draft)
    // Defensive: an unquoted YAML date parses as a Date, not a string, and
    // arrives here as null. One malformed post should cost its own position in
    // the list, not the entire index.
    .toSorted((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))
)

const site = useSiteUrl()

useSeoMeta({
  title: 'Blog',
  description:
    'Writing on keeping programming skills sharp: how memory for code decays, what retrieval practice does about it, and how BlankCode is built.',
  ogTitle: 'BlankCode Blog',
  ogDescription:
    'Writing on keeping programming skills sharp: how memory for code decays, what retrieval practice does about it, and how BlankCode is built.',
  ogType: 'website',
  ogUrl: `${site}/blog`,
  twitterCard: 'summary',
})

useHead({
  link: [{ rel: 'canonical', href: `${site}/blog` }],
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
  <div class="container py-12">
    <div class="max-w-3xl mx-auto">
      <h1 class="display text-2xl md:text-3xl mb-2">Blog</h1>
      <p class="text-muted-foreground mb-10">
        On why programming skills fade, what actually brings them back, and how this thing is built.
      </p>

      <p v-if="posts.length === 0" class="text-muted-foreground">Nothing published yet.</p>

      <ol v-else class="space-y-8">
        <li v-for="post in posts" :key="post.path" class="border-b border-rule pb-8 last:border-0">
          <NuxtLink :to="post.path" class="group block">
            <h2 class="display text-lg md:text-xl mb-2 group-hover:text-signal transition-colors">
              {{ post.title }}
            </h2>
            <p class="text-muted-foreground mb-3">{{ post.description }}</p>
            <div class="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <time :datetime="post.date">{{ formatDate(post.date) }}</time>
              <span
                v-for="tag in post.tags"
                :key="tag"
                class="px-2 py-0.5 rounded-full bg-accent text-accent-foreground"
              >
                {{ tag }}
              </span>
            </div>
          </NuxtLink>
        </li>
      </ol>
    </div>
  </div>
</template>
