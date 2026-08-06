<script setup lang="ts">
import { reactive } from 'vue'
import Input from './input.vue'

const state = reactive({
  value: '',
  label: 'Email',
  placeholder: 'you@example.com',
  error: '',
  disabled: false,
  srOnlyLabel: false,
})
</script>

<template>
  <Story title="Input" group="ui" :layout="{ type: 'grid', width: 400 }">
    <Variant title="Playground">
      <Input
        v-model="state.value"
        :label="state.label"
        :placeholder="state.placeholder"
        :error="state.error"
        :disabled="state.disabled"
        :sr-only-label="state.srOnlyLabel"
      />

      <template #controls>
        <HstText v-model="state.label" title="Label" />
        <HstText v-model="state.placeholder" title="Placeholder" />
        <HstText v-model="state.error" title="Error" />
        <HstCheckbox v-model="state.disabled" title="Disabled" />
        <HstCheckbox v-model="state.srOnlyLabel" title="Visually-hidden label" />
      </template>
    </Variant>

    <!-- The error path also flips aria-invalid and wires aria-describedby;
         inspect the rendered markup here when touching that logic. -->
    <Variant title="States">
      <div class="space-y-4">
        <Input label="Default" placeholder="Type here" />
        <Input label="With value" model-value="fizzbuzz" />
        <Input label="Disabled" placeholder="Unavailable" disabled />
        <Input label="Password" type="password" model-value="hunter2" />
        <Input label="Email" model-value="not-an-email" error="Enter a valid email address" />
      </div>
    </Variant>

    <Variant title="Visually-hidden label">
      <Input label="Search exercises" placeholder="Search exercises" sr-only-label />
    </Variant>
  </Story>
</template>
