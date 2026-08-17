<script setup lang="ts">
import type { Exercise } from '@blankcode/shared'
import ExerciseWorkspace from '~/components/exercise/exercise-workspace.vue'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const trackSlug = computed(() => route.params['trackSlug'] as string)
const conceptSlug = computed(() => route.params['conceptSlug'] as string)
const exerciseSlug = computed(() => route.params['exerciseSlug'] as string)

const { data: exercise } = await useAsyncData(
  () => `exercise-${trackSlug.value}-${conceptSlug.value}-${exerciseSlug.value}`,
  () =>
    $fetch<Exercise>(
      `/api/tracks/${trackSlug.value}/concepts/${conceptSlug.value}/exercises/${exerciseSlug.value}`
    ).catch(() => null)
)

if (!exercise.value) {
  throw createError({ statusCode: 404, statusMessage: 'Exercise not found', fatal: true })
}
</script>

<template>
  <ExerciseWorkspace v-if="exercise" :exercise-id="exercise.id" />
</template>
