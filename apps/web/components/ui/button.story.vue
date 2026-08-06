<script setup lang="ts">
import { reactive } from 'vue'
import Button from './button.vue'

const VARIANTS = ['primary', 'secondary', 'destructive', 'outline', 'ghost'] as const
const SIZES = ['sm', 'md', 'lg'] as const

const state = reactive({
  variant: 'primary' as (typeof VARIANTS)[number],
  size: 'md' as (typeof SIZES)[number],
  disabled: false,
  loading: false,
  label: 'Run Tests',
})
</script>

<template>
  <Story title="Button" group="ui" :layout="{ type: 'grid', width: 320 }">
    <Variant title="Playground">
      <Button
        :variant="state.variant"
        :size="state.size"
        :disabled="state.disabled"
        :loading="state.loading"
      >
        {{ state.label }}
      </Button>

      <template #controls>
        <HstSelect v-model="state.variant" title="Variant" :options="[...VARIANTS]" />
        <HstSelect v-model="state.size" title="Size" :options="[...SIZES]" />
        <HstCheckbox v-model="state.disabled" title="Disabled" />
        <HstCheckbox v-model="state.loading" title="Loading" />
        <HstText v-model="state.label" title="Label" />
      </template>
    </Variant>

    <Variant title="All variants">
      <div class="flex flex-col items-start gap-3">
        <Button v-for="variant in VARIANTS" :key="variant" :variant="variant">
          {{ variant }}
        </Button>
      </div>
    </Variant>

    <Variant title="All sizes">
      <div class="flex items-center gap-3">
        <Button v-for="size in SIZES" :key="size" :size="size">{{ size }}</Button>
      </div>
    </Variant>

    <!-- Loading must keep the button non-interactive: the exercise page relies
         on it to stop double submissions while tests are running. -->
    <Variant title="Loading and disabled">
      <div class="flex flex-col items-start gap-3">
        <Button loading>Running tests</Button>
        <Button disabled>Disabled</Button>
        <Button variant="outline" loading>Outline loading</Button>
      </div>
    </Variant>
  </Story>
</template>
