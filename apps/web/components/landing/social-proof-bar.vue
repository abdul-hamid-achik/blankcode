<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { useInView } from '~/composables/useInView'

const sectionRef = ref<HTMLElement | null>(null)
const isInView = useInView(sectionRef)

const stats = [
  { value: 7, display: '7', label: 'Languages', isNumeric: true },
  { value: 4, display: '4', label: 'Difficulty Levels', isNumeric: true },
  { value: 0, display: 'Instant', label: 'Test Feedback', isNumeric: false },
  { value: 0, display: '100%', label: 'Free & Open Source', isNumeric: false },
]

const animatedValues = ref<(number | null)[]>(stats.map(() => null))
let animationFrameId: number | null = null

function animateCountUp(index: number, target: number) {
  const duration = 1000
  const start = performance.now()

  function tick(now: number) {
    const elapsed = now - start
    const progress = Math.min(elapsed / duration, 1)
    const eased = 1 - (1 - progress) ** 3
    animatedValues.value[index] = Math.round(eased * target)

    if (progress < 1) {
      animationFrameId = requestAnimationFrame(tick)
    }
  }

  animationFrameId = requestAnimationFrame(tick)
}

watch(isInView, (visible) => {
  if (visible) {
    stats.forEach((stat, i) => {
      if (stat.isNumeric) {
        setTimeout(() => animateCountUp(i, stat.value), i * 100)
      }
    })
  }
})

onUnmounted(() => {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
  }
})

function getDisplay(index: number): string {
  const stat = stats[index]
  if (!stat.isNumeric) return stat.display
  const animated = animatedValues.value[index]
  return animated !== null ? String(animated) : '0'
}
</script>

<template>
  <section ref="sectionRef" class="border-y border-border bg-muted/20 py-8 md:py-10">
    <div class="container">
      <div class="grid grid-cols-2 md:flex md:flex-wrap items-center justify-center gap-6 md:gap-16">
        <div
          v-for="(stat, index) in stats"
          :key="stat.label"
          class="text-center"
          :class="[
            isInView ? 'animate-fade-slide-up' : 'opacity-0',
            isInView && index === 1 ? 'animation-delay-100' : '',
            isInView && index === 2 ? 'animation-delay-200' : '',
            isInView && index === 3 ? 'animation-delay-300' : '',
          ]"
        >
          <div class="text-2xl md:text-3xl font-bold text-foreground">
            {{ getDisplay(index) }}
          </div>
          <div class="text-sm text-muted-foreground">{{ stat.label }}</div>
        </div>
      </div>
    </div>
  </section>
</template>
