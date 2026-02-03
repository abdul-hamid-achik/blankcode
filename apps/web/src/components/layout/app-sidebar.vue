<script setup lang="ts">
import type { Concept } from '@blankcode/shared'
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

interface Props {
  concepts: Concept[]
  trackSlug: string
}

const props = defineProps<Props>()
const route = useRoute()

const currentConceptSlug = computed(() => route.params['conceptSlug'] as string | undefined)
</script>

<template>
  <aside class="w-64 border-r border-border bg-muted/30 p-4">
    <nav class="space-y-1">
      <RouterLink
        v-for="concept in concepts"
        :key="concept.id"
        :to="`/tracks/${trackSlug}/${concept.slug}`"
        :class="[
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
          currentConceptSlug === concept.slug
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        ]"
      >
        <span class="flex-1">{{ concept.name }}</span>
      </RouterLink>
    </nav>
  </aside>
</template>
