<script setup lang="ts">
import { reactive } from 'vue'
import RadialProgress from './radial-progress.vue'

const state = reactive({
  value: 42,
  max: 100,
  size: 120,
  strokeWidth: 8,
})
</script>

<template>
  <Story title="RadialProgress" group="ui" :layout="{ type: 'grid', width: 260 }">
    <Variant title="Playground">
      <RadialProgress
        :value="state.value"
        :max="state.max"
        :size="state.size"
        :stroke-width="state.strokeWidth"
      />

      <template #controls>
        <HstNumber v-model="state.value" title="Value" />
        <HstNumber v-model="state.max" title="Max" />
        <HstNumber v-model="state.size" title="Size (px)" />
        <HstNumber v-model="state.strokeWidth" title="Stroke width" />
      </template>
    </Variant>

    <Variant title="Progress steps">
      <div class="flex flex-wrap items-center gap-6">
        <RadialProgress v-for="v in [0, 25, 50, 75, 100]" :key="v" :value="v" :size="90" />
      </div>
    </Variant>

    <!-- Out-of-range input is clamped rather than drawing an invalid arc. -->
    <Variant title="Out-of-range values are clamped">
      <div class="flex flex-wrap items-center gap-6">
        <RadialProgress :value="-20" :size="90" />
        <RadialProgress :value="180" :size="90" />
        <RadialProgress :value="5" :max="0" :size="90" />
      </div>
    </Variant>

    <Variant title="Sizes">
      <div class="flex flex-wrap items-center gap-6">
        <RadialProgress :value="66" :size="60" :stroke-width="5" />
        <RadialProgress :value="66" :size="120" :stroke-width="8" />
        <RadialProgress :value="66" :size="180" :stroke-width="12" />
      </div>
    </Variant>
  </Story>
</template>
