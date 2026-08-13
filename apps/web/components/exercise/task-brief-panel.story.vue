<script setup lang="ts">
import TaskBriefPanel from './task-brief-panel.vue'
</script>

<template>
  <Story title="TaskBriefPanel" group="exercise">
    <Variant title="Review">
      <TaskBriefPanel
        type="review"
        slug="ts-review-001"
        description="The pagination helper below was generated and shipped. It loses records."
      />
    </Variant>
    <Variant title="Challenge">
      <TaskBriefPanel
        type="challenge"
        slug="ts-challenge-001"
        description="Implement a counter class with proper TypeScript types from scratch."
      />
    </Variant>
    <Variant title="Blank">
      <TaskBriefPanel type="blank" description="Fill in the missing type parameter." />
    </Variant>
  </Story>
</template>
