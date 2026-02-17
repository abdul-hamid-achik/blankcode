<script setup lang="ts">
import { allTutorials } from 'content-collections'
import DOMPurify from 'dompurify'
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import Button from '@/components/ui/button.vue'

const route = useRoute()
const slug = computed(() => route.params['slug'] as string)

const tutorial = computed(() => allTutorials.find((t) => t.slug === slug.value))

const sanitizedHtml = computed(() => {
  if (!tutorial.value) return ''
  return DOMPurify.sanitize(tutorial.value.html)
})

const difficultyColor: Record<string, string> = {
  beginner: 'bg-green-500/10 text-green-500',
  intermediate: 'bg-yellow-500/10 text-yellow-500',
  advanced: 'bg-red-500/10 text-red-500',
}
</script>

<template>
  <div class="container py-12">
    <div v-if="tutorial" class="max-w-3xl mx-auto">
      <RouterLink
        to="/tutorials"
        class="text-sm text-muted-foreground hover:text-foreground mb-6 inline-block"
      >
        &#8592; Back to Tutorials
      </RouterLink>

      <div class="mb-8">
        <div class="flex flex-wrap items-center gap-2 mb-3">
          <span
            :class="[
              'px-2 py-0.5 text-xs rounded-full capitalize',
              difficultyColor[tutorial.difficulty],
            ]"
          >
            {{ tutorial.difficulty }}
          </span>
          <RouterLink
            v-if="tutorial.track"
            :to="`/tracks/${tutorial.track}`"
            class="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary capitalize hover:bg-primary/20 transition-colors"
          >
            {{ tutorial.track }}
          </RouterLink>
          <span
            v-for="tag in tutorial.tags"
            :key="tag"
            class="px-2 py-0.5 text-xs rounded bg-muted text-muted-foreground"
          >
            {{ tag }}
          </span>
        </div>

        <h1 class="text-3xl font-bold mb-2">{{ tutorial.title }}</h1>
        <p class="text-muted-foreground">{{ tutorial.description }}</p>
      </div>

      <div
        class="prose prose-invert max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-a:text-primary hover:prose-a:text-primary/80 prose-code:text-primary prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-li:text-muted-foreground prose-ul:text-muted-foreground prose-ol:text-muted-foreground"
        v-html="sanitizedHtml"
      />
    </div>

    <div v-else class="text-center py-24">
      <h1 class="text-6xl font-bold text-muted-foreground">404</h1>
      <p class="text-xl text-muted-foreground mt-4">Tutorial not found</p>
      <p class="text-sm text-muted-foreground mt-2">
        The tutorial you're looking for doesn't exist or has been moved.
      </p>
      <RouterLink to="/tutorials" class="inline-block mt-8">
        <Button>Back to Tutorials</Button>
      </RouterLink>
    </div>
  </div>
</template>
