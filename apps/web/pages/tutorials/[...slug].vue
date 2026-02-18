<script setup lang="ts">
const route = useRoute()

const slugPath = computed(() => {
  const s = route.params['slug']
  return Array.isArray(s) ? s.join('/') : s
})

const tutorialPath = computed(() => `/tutorials/${slugPath.value}`)

const { data: tutorial } = await useAsyncData(`tutorial-${slugPath.value}`, () =>
  queryCollection('tutorials').path(tutorialPath.value).first()
)

const difficultyColor: Record<string, string> = {
  beginner: 'bg-green-500/10 text-green-500',
  intermediate: 'bg-yellow-500/10 text-yellow-500',
  advanced: 'bg-red-500/10 text-red-500',
}
</script>

<template>
  <div class="container py-12">
    <div v-if="tutorial" class="max-w-3xl mx-auto">
      <NuxtLink to="/tutorials" class="text-sm text-muted-foreground hover:text-foreground mb-6 inline-block">
        &#8592; Back to Tutorials
      </NuxtLink>

      <div class="mb-8">
        <div class="flex flex-wrap items-center gap-2 mb-3">
          <span :class="['px-2 py-0.5 text-xs rounded-full capitalize', difficultyColor[(tutorial as any).difficulty]]">
            {{ (tutorial as any).difficulty }}
          </span>
          <NuxtLink
            v-if="(tutorial as any).track"
            :to="`/tracks/${(tutorial as any).track}`"
            class="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary capitalize hover:bg-primary/20 transition-colors"
          >
            {{ (tutorial as any).track }}
          </NuxtLink>
          <span
            v-for="tag in (tutorial as any).tags"
            :key="tag"
            class="px-2 py-0.5 text-xs rounded bg-muted text-muted-foreground"
          >
            {{ tag }}
          </span>
        </div>

        <h1 class="text-3xl font-bold mb-2">{{ (tutorial as any).title }}</h1>
        <p class="text-muted-foreground">{{ (tutorial as any).description }}</p>
      </div>

      <div class="prose prose-invert max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-a:text-primary hover:prose-a:text-primary/80 prose-code:text-primary prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-li:text-muted-foreground prose-ul:text-muted-foreground prose-ol:text-muted-foreground">
        <ContentRenderer :value="tutorial" />
      </div>
    </div>

    <div v-else class="text-center py-24">
      <h1 class="text-6xl font-bold text-muted-foreground">404</h1>
      <p class="text-xl text-muted-foreground mt-4">Tutorial not found</p>
      <p class="text-sm text-muted-foreground mt-2">
        The tutorial you're looking for doesn't exist or has been moved.
      </p>
      <NuxtLink to="/tutorials" class="inline-block mt-8">
        <button class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Back to Tutorials
        </button>
      </NuxtLink>
    </div>
  </div>
</template>
