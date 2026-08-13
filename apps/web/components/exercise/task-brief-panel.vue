<script setup lang="ts">
import { computed } from 'vue'
import { AUTHORED_BRIEFS } from '~/utils/authored-briefs'
import { presentTaskBrief } from '~/utils/task-brief'

const props = defineProps<{
  type: string
  description: string
  slug?: string
}>()

const brief = computed(() =>
  presentTaskBrief({
    type: props.type,
    description: props.description,
    authoredBrief: props.slug ? AUTHORED_BRIEFS[props.slug] : undefined,
  })
)

const paragraphs = computed(() => brief.value.body.split(/\n\n+/).filter(Boolean))

const markClass = computed(() =>
  props.type === 'review'
    ? 'border-signal bg-signal/5'
    : props.type === 'challenge'
      ? 'border-rule-strong bg-muted/30'
      : 'border-rule bg-transparent'
)
</script>

<template>
  <div v-if="brief.framing || paragraphs.length" class="mt-3 max-w-2xl">
    <p v-if="brief.framing" class="border-l-2 py-2 pl-3 text-sm text-foreground" :class="markClass">
      {{ brief.framing }}
    </p>
    <div class="mt-3 space-y-2 text-sm leading-relaxed text-foreground">
      <p v-for="(paragraph, i) in paragraphs" :key="i" class="whitespace-pre-wrap">
        {{ paragraph }}
      </p>
    </div>
  </div>
</template>
