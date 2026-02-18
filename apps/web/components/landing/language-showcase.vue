<script setup lang="ts">
import { ref } from 'vue'
import { useInView } from '~/composables/useInView'

const sectionRef = ref<HTMLElement | null>(null)
const isInView = useInView(sectionRef)

const languages = [
  { name: 'TypeScript', slug: 'typescript', color: '#3178C6', letter: 'T' },
  { name: 'JavaScript', slug: 'javascript', color: '#F7DF1E', letter: 'J', darkText: true },
  { name: 'Python', slug: 'python', color: '#3776AB', letter: 'P' },
  { name: 'Go', slug: 'go', color: '#00ADD8', letter: 'G' },
  { name: 'Rust', slug: 'rust', color: '#DEA584', letter: 'R' },
  { name: 'Vue', slug: 'vue', color: '#4FC08D', letter: 'V' },
  { name: 'React', slug: 'react', color: '#61DAFB', letter: 'R', darkText: true },
]
</script>

<template>
  <section ref="sectionRef" class="py-20 md:py-28">
    <div class="container">
      <div :class="[isInView ? 'animate-fade-slide-up' : 'opacity-0']">
        <h2 class="text-3xl md:text-4xl font-bold text-center mb-4">Pick Your Language</h2>
        <p class="text-muted-foreground text-center mb-12 max-w-xl mx-auto">
          Structured tracks from beginner to expert. Start with what you know or explore something new.
        </p>
      </div>

      <div class="flex flex-wrap items-center justify-center gap-3 md:gap-4">
        <NuxtLink
          v-for="(lang, index) in languages"
          :key="lang.slug"
          :to="`/tracks/${lang.slug}`"
          :class="[
            'inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-border bg-card text-sm font-medium hover:border-primary/40 hover:bg-primary/5 transition-all duration-200',
            isInView ? 'animate-fade-slide-up' : 'opacity-0',
          ]"
          :style="isInView ? { animationDelay: `${(index + 1) * 60}ms` } : {}"
        >
          <span
            class="w-5 h-5 rounded flex items-center justify-center text-xs font-bold"
            :style="{
              backgroundColor: `${lang.color}20`,
              color: lang.color,
            }"
          >
            {{ lang.letter }}
          </span>
          {{ lang.name }}
        </NuxtLink>
      </div>
    </div>
  </section>
</template>
