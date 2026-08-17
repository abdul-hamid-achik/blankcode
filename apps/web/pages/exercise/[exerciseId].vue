<script setup lang="ts">
import ExerciseWorkspace from '~/components/exercise/exercise-workspace.vue'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const exerciseId = computed(() => route.params['exerciseId'] as string)
</script>

<template>
  <ExerciseWorkspace :exercise-id="exerciseId" />
</template>
