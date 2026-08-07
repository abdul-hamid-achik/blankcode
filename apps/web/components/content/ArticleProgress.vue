<script setup lang="ts">
/**
 * A two-pixel line at the top of the viewport that fills as you read.
 *
 * The one piece of "scroll UI" this product allows itself: it answers a real
 * question (how much is left?) with the cheapest possible ink, in the signal
 * color the rest of the product reserves for your own marks.
 */

const progress = ref(0)
let raf = 0

function measure() {
  const doc = document.documentElement
  const total = doc.scrollHeight - doc.clientHeight
  progress.value = total > 0 ? Math.min(1, Math.max(0, doc.scrollTop / total)) : 0
}

function onScroll() {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(measure)
}

onMounted(() => {
  measure()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll, { passive: true })
})

onUnmounted(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
})
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5" aria-hidden="true">
    <div
      class="h-full bg-signal transition-transform duration-75 ease-linear"
      :style="{ transform: `scaleX(${progress})`, transformOrigin: 'left' }"
    />
  </div>
</template>
