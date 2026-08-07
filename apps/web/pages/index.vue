<script setup lang="ts">
import LanguageShowcase from '~/components/landing/language-showcase.vue'
import PracticeHero from '~/components/landing/practice-hero.vue'
import PracticeLoop from '~/components/landing/practice-loop.vue'
import ProductFrame from '~/components/landing/product-frame.vue'
import StartPractising from '~/components/landing/start-practising.vue'

useHead({
  title: 'BlankCode — keep your hands from forgetting',
  meta: [
    {
      name: 'description',
      content:
        "Read almost-finished code, fill in the blanks, and run the exercise's real test suite in an isolated sandbox. Spaced repetition brings each exercise back before you forget it. Nothing to install.",
    },
  ],
})
</script>

<template>
  <div>
    <PracticeHero />
    <ProductFrame />
    <PracticeLoop />
    <LanguageShowcase />
    <!--
      Pricing slots in here when plans exist: everything above says what the
      product is, everything below closes on the account. Mount a
      `landing/pricing-plans.vue` in this gap and neither neighbour moves.
    -->
    <StartPractising />
  </div>
</template>
