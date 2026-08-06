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
        'Self-hosted code practice. Fill in the blanks in working code, run the real test suite in a sandbox, and let spaced repetition bring exercises back before you forget them.',
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
