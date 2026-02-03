<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  value: number
  max?: number
  size?: number
  strokeWidth?: number
  color?: string
}

const props = withDefaults(defineProps<Props>(), {
  max: 100,
  size: 120,
  strokeWidth: 8,
  color: 'var(--primary)',
})

const normalizedValue = computed(() =>
  Math.min(Math.max(0, props.value), props.max)
)

const percentage = computed(() =>
  props.max > 0 ? (normalizedValue.value / props.max) * 100 : 0
)

const svgSize = computed(() => props.size)
const radius = computed(() => (props.size - props.strokeWidth) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const strokeDashoffset = computed(
  () => circumference.value - (percentage.value / 100) * circumference.value
)
const center = computed(() => props.size / 2)
</script>

<template>
  <div class="relative inline-flex items-center justify-center">
    <svg
      :width="svgSize"
      :height="svgSize"
      class="transform -rotate-90"
    >
      <!-- Background circle -->
      <circle
        :cx="center"
        :cy="center"
        :r="radius"
        fill="none"
        :stroke-width="strokeWidth"
        class="stroke-muted"
      />
      <!-- Progress circle -->
      <circle
        :cx="center"
        :cy="center"
        :r="radius"
        fill="none"
        :stroke-width="strokeWidth"
        :stroke="color"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="strokeDashoffset"
        class="transition-all duration-500 ease-out"
      />
    </svg>
    <div class="absolute inset-0 flex items-center justify-center">
      <slot>
        <span class="text-2xl font-bold">{{ Math.round(percentage) }}%</span>
      </slot>
    </div>
  </div>
</template>
