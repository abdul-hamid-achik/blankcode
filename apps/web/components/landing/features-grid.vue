<script setup lang="ts">
import { ref } from 'vue'
import { useInView } from '~/composables/useInView'

const sectionRef = ref<HTMLElement | null>(null)
const isInView = useInView(sectionRef)

const features = [
  {
    title: 'Fill in the Blanks',
    description:
      'Read real code with strategic gaps. Fill in the missing pieces to prove you understand the concept -- not just memorized it.',
    icon: 'code',
  },
  {
    title: 'Instant Test Feedback',
    description:
      'Every submission runs against real test suites in a sandboxed environment. Know immediately if your solution is correct.',
    icon: 'play',
  },
  {
    title: '7 Language Tracks',
    description:
      'Practice TypeScript, JavaScript, Python, Go, Rust, Vue, React, and Node.js. Each track is structured from beginner to expert.',
    icon: 'globe',
  },
  {
    title: 'Progress Tracking',
    description:
      'Track your completion rate, mastery levels, and streaks across every concept. See exactly where to focus next.',
    icon: 'chart',
  },
  {
    title: 'Concept Mastery',
    description:
      'Exercises are organized by concept within each language. Build deep understanding one topic at a time.',
    icon: 'target',
  },
  {
    title: 'Built for Developers',
    description:
      'CodeMirror editor with syntax highlighting, keyboard shortcuts, and a familiar IDE feel. No toy editors.',
    icon: 'terminal',
  },
]
</script>

<template>
  <section ref="sectionRef" class="py-20 md:py-28 bg-muted/20">
    <div class="container">
      <div :class="[isInView ? 'animate-fade-slide-up' : 'opacity-0']">
        <h2 class="text-3xl md:text-4xl font-bold text-center mb-4">Everything You Need to Level Up</h2>
        <p class="text-muted-foreground text-center mb-16 max-w-xl mx-auto">
          A focused learning environment designed for building real coding skills.
        </p>
      </div>

      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        <div
          v-for="(feature, index) in features"
          :key="feature.title"
          :class="[
            'rounded-xl border border-border bg-card p-6 md:p-8 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all duration-200',
            isInView ? 'animate-fade-slide-up' : 'opacity-0',
          ]"
          :style="isInView ? { animationDelay: `${(index + 1) * 80}ms` } : {}"
        >
          <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
            <!-- Code icon -->
            <svg v-if="feature.icon === 'code'" class="w-5 h-5 text-primary" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M7 5L2 10l5 5M13 5l5 5-5 5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <!-- Play icon -->
            <svg v-else-if="feature.icon === 'play'" class="w-5 h-5 text-primary" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="10" cy="10" r="8" />
              <path d="M8 6.5l6 3.5-6 3.5V6.5z" fill="currentColor" stroke="none" />
            </svg>
            <!-- Globe icon -->
            <svg v-else-if="feature.icon === 'globe'" class="w-5 h-5 text-primary" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="10" cy="10" r="8" />
              <path d="M2 10h16M10 2c2.5 2.5 3.5 5 3.5 8s-1 5.5-3.5 8c-2.5-2.5-3.5-5-3.5-8s1-5.5 3.5-8z" />
            </svg>
            <!-- Chart icon -->
            <svg v-else-if="feature.icon === 'chart'" class="w-5 h-5 text-primary" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M3 17l4-6 4 3 6-10" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <!-- Target icon -->
            <svg v-else-if="feature.icon === 'target'" class="w-5 h-5 text-primary" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="10" cy="10" r="8" />
              <circle cx="10" cy="10" r="5" />
              <circle cx="10" cy="10" r="2" />
            </svg>
            <!-- Terminal icon -->
            <svg v-else-if="feature.icon === 'terminal'" class="w-5 h-5 text-primary" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M4 7l4 3-4 3M10 14h6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <h3 class="text-lg font-semibold mb-2">{{ feature.title }}</h3>
          <p class="text-sm text-muted-foreground leading-relaxed">{{ feature.description }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
