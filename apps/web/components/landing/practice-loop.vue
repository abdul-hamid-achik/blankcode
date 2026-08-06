<script setup lang="ts">
/**
 * The loop is genuinely ordered — each step only makes sense after the one
 * before it — so the numbering carries information rather than decorating.
 */
const STEPS = [
  {
    label: 'read',
    title: 'Start from working code',
    body: 'Every exercise is a real, complete implementation with a few pieces removed. You are never staring at an empty file.',
  },
  {
    label: 'fill',
    title: 'Supply what is missing',
    body: 'Blanks sit inline in the editor. Tab moves between them. The gaps are chosen to be the part of the concept you actually have to know.',
  },
  {
    label: 'run',
    title: 'Run the real test suite',
    body: 'Your answer executes in a Docker sandbox with no network and hard memory, CPU, and time limits. The output you see is the test runner’s.',
  },
  {
    label: 'return',
    title: 'Meet it again before you forget',
    body: 'Passing schedules the exercise forward on an SM-2 interval. Rate the recall honestly and the schedule adapts.',
  },
]
</script>

<template>
  <section class="border-b border-rule">
    <div class="container py-16 md:py-20">
      <p class="eyebrow mb-3">the loop</p>
      <h2 class="display text-2xl md:text-3xl mb-12 max-w-lg">
        Four steps, repeated until the concept stops needing them.
      </h2>

      <ol class="grid gap-px bg-rule md:grid-cols-2 lg:grid-cols-4 border border-rule">
        <li v-for="(step, i) in STEPS" :key="step.label" class="bg-background p-6">
          <div class="flex items-baseline gap-3 mb-4">
            <span class="font-mono text-xs text-signal font-medium">{{
              String(i + 1).padStart(2, '0')
            }}</span>
            <span class="eyebrow">{{ step.label }}</span>
          </div>
          <h3 class="display text-base mb-2">{{ step.title }}</h3>
          <p class="text-sm text-muted-foreground leading-relaxed">{{ step.body }}</p>
        </li>
      </ol>
    </div>
  </section>
</template>
