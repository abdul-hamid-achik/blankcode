<script setup lang="ts">
import { ref } from 'vue'
import Button from '~/components/ui/button.vue'
import { useInView } from '~/composables/useInView'

const sectionRef = ref<HTMLElement | null>(null)
const isInView = useInView(sectionRef)
</script>

<template>
  <section ref="sectionRef" class="py-20 md:py-28">
    <div class="container">
      <div
        :class="[
          'max-w-4xl mx-auto rounded-2xl p-10 md:p-16 border border-primary/20 text-center cta-gradient',
          isInView ? 'animate-fade-slide-up' : 'opacity-0',
        ]"
      >
        <h2 class="text-3xl md:text-4xl font-bold mb-4">Ready to Start Coding?</h2>
        <p class="text-lg text-muted-foreground mb-8 max-w-lg mx-auto">
          Join BlankCode and start building real coding skills today.
          No credit card. No lectures. Just you and the code.
        </p>
        <NuxtLink to="/register">
          <Button size="lg">Create Free Account</Button>
        </NuxtLink>
        <p class="text-sm text-muted-foreground mt-4">
          Already have an account?
          <NuxtLink to="/login" class="text-primary hover:underline">Log in</NuxtLink>
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cta-gradient {
  background: linear-gradient(to bottom right, hsl(var(--primary) / 0.1), hsl(var(--primary) / 0.05), transparent);
}

:global(.dark) .cta-gradient {
  background: linear-gradient(to bottom right, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.08), transparent);
}
</style>
