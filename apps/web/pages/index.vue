<script setup lang="ts">
import LanguageShowcase from '~/components/landing/language-showcase.vue'
import PracticeHero from '~/components/landing/practice-hero.vue'
import PracticeLoop from '~/components/landing/practice-loop.vue'
import StartPractising from '~/components/landing/start-practising.vue'

useHead({
  title: 'BlankCode — keep your hands from forgetting',
  meta: [
    {
      name: 'description',
      content:
        "Fill in the blanks in working code, run the exercise's real test suite in a sandbox, and let spaced repetition bring it back before you forget. Seven languages, nothing to install.",
    },
  ],
})
</script>

<template>
  <div>
    <PracticeHero />
    <PracticeLoop />
    <LanguageShowcase />
    <StartPractising />
  </div>
</template>
