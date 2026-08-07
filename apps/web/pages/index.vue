<script setup lang="ts">
import LanguageShowcase from '~/components/landing/language-showcase.vue'
import PracticeHero from '~/components/landing/practice-hero.vue'
import PracticeLoop from '~/components/landing/practice-loop.vue'
import RunItYourself from '~/components/landing/run-it-yourself.vue'

useHead({
  title: 'BlankCode — keep your hands from forgetting',
  meta: [
    {
      name: 'description',
      content:
        "Fill in the blanks in working code, run the exercise's real test suite in a sandbox, and let spaced repetition bring it back before you forget. Seven languages, free, open source.",
    },
  ],
})
</script>

<template>
  <div>
    <PracticeHero />
    <PracticeLoop />
    <LanguageShowcase />
    <RunItYourself />
  </div>
</template>
