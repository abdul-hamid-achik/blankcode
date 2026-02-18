<script setup lang="ts">
import Button from '~/components/ui/button.vue'
</script>

<template>
  <section class="relative py-16 md:py-36 lg:py-44 overflow-hidden">
    <div class="hero-glow" />
    <div class="container relative text-center">
      <div class="max-w-3xl mx-auto">
        <div class="animate-fade-slide-up">
          <span
            class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-sm font-medium"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 12L1 8l3-4M12 4l3 4-3 4M10 2L6 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Open Source
          </span>
        </div>

        <h1
          class="animate-fade-slide-up animation-delay-100 text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mt-6 mb-6"
        >
          Learn to Code by
          <br />
          <span class="text-primary">Filling in the Blanks</span>
        </h1>

        <p
          class="animate-fade-slide-up animation-delay-200 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-8"
        >
          Interactive exercises where you fill in missing code, run real tests,
          and build muscle memory across 7 languages. No lectures. Just practice.
        </p>

        <div class="animate-fade-slide-up animation-delay-300 flex items-center justify-center gap-4">
          <NuxtLink to="/register">
            <Button size="lg">Start Practicing -- Free</Button>
          </NuxtLink>
          <NuxtLink to="/tracks">
            <Button variant="outline" size="lg">Browse Tracks</Button>
          </NuxtLink>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero-glow {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.hero-glow::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  height: 100%;
  background: radial-gradient(ellipse at 50% 0%, hsl(var(--primary) / 0.08), transparent 70%);
}

:global(.dark) .hero-glow::before {
  background: radial-gradient(ellipse at 50% 0%, hsl(var(--primary) / 0.12), transparent 70%);
}
</style>
