<script setup lang="ts">
import { usePageSeo } from '~/composables/usePageSeo'
import { readingMinutes, sortPostsNewestFirst } from '~/utils/blog'

interface BlogPost {
  path: string
  title: string
  description: string
  date: string
  author: string
  tags: string[]
  draft: boolean
  body: unknown
}

const { data: allPosts } = await useAsyncData('blog-index', () => queryCollection('blog').all())

// Newest first, and drafts never reach a reader. The date sort is defensive
// on purpose: an unquoted YAML date parses as a Date, not a string, and
// arrives here as null — one malformed post should cost its own position in
// the list, not the entire index.
const posts = computed(() =>
  sortPostsNewestFirst(
    ((allPosts.value ?? []) as unknown as BlogPost[]).filter((post) => !post.draft)
  ).map((post) => ({ ...post, minutes: readingMinutes(post.body) }))
)

/** The newest post reads as the lead; everything under it is the ledger. */
const lead = computed(() => posts.value[0])
const rest = computed(() => posts.value.slice(1))

usePageSeo({
  title: 'Blog',
  description:
    'Writing on keeping programming skills sharp: how memory for code decays, what retrieval practice does about it, and how BlankCode is built.',
  path: '/blog',
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
  <div class="container py-12 md:py-16">
    <div class="mx-auto max-w-3xl">
      <header class="mb-12 md:mb-16">
        <p class="eyebrow mb-3">
          blog — {{ posts.length }} {{ posts.length === 1 ? 'entry' : 'entries' }}
        </p>
        <h1 class="display text-3xl md:text-4xl mb-4">Blog</h1>
        <p class="max-w-[52ch] text-muted-foreground">
          On why programming skills fade, what actually brings them back, and how this thing is
          built.
        </p>
      </header>

      <p v-if="posts.length === 0" class="text-muted-foreground">Nothing published yet.</p>

      <template v-else>
        <!-- Lead: the newest post, at full width and full size. -->
        <article v-if="lead" class="border-y border-rule-strong py-10">
          <p class="eyebrow mb-4">latest</p>
          <NuxtLink :to="lead.path" class="group block">
            <h2
              class="display text-2xl md:text-[2rem] leading-tight mb-4 transition-colors group-hover:text-signal"
            >
              {{ lead.title }}
            </h2>
            <p class="mb-5 max-w-[60ch] leading-relaxed text-muted-foreground">
              {{ lead.description }}
            </p>
            <p
              class="flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground"
            >
              <time :datetime="lead.date">{{ formatDate(lead.date) }}</time>
              <span>{{ lead.minutes }} min read</span>
              <span v-for="tag in lead.tags" :key="tag">#{{ tag }}</span>
            </p>
          </NuxtLink>
        </article>

        <!-- The ledger: every earlier post as a ruled row, date in the margin. -->
        <section v-if="rest.length > 0" aria-label="Earlier posts">
          <ol>
            <li v-for="post in rest" :key="post.path" class="border-b border-rule">
              <NuxtLink
                :to="post.path"
                class="group grid gap-x-8 gap-y-2 py-7 md:grid-cols-[10rem_1fr]"
              >
                <p class="font-mono text-xs leading-6 text-muted-foreground">
                  <time :datetime="post.date" class="block">{{ formatDate(post.date) }}</time>
                  <span class="block">{{ post.minutes }} min read</span>
                </p>
                <div>
                  <h2
                    class="display text-lg md:text-xl leading-snug mb-2 transition-colors group-hover:text-signal"
                  >
                    {{ post.title }}
                  </h2>
                  <p class="mb-3 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
                    {{ post.description }}
                  </p>
                  <p class="flex flex-wrap gap-x-3 font-mono text-xs text-muted-foreground/80">
                    <span v-for="tag in post.tags" :key="tag">#{{ tag }}</span>
                  </p>
                </div>
              </NuxtLink>
            </li>
          </ol>
        </section>
      </template>
    </div>
  </div>
</template>
