<script setup lang="ts">
import { ACHIEVEMENTS } from '@blankcode/shared'
import { computed, onMounted } from 'vue'
import Button from '~/components/ui/button.vue'
import Card from '~/components/ui/card.vue'
import { useAsync } from '~/composables/useAsync'

/**
 * Marks, not trophies. The old page was a gradient bar, a row of padlock
 * emoji, and "Achievement Showcase" — the voice of a product that needs you
 * excited. These are records of things that happened: what each one means,
 * when it happened, and for the rest, what would make it happen. Locked
 * cards used to print the raw requirement enum ("perfect_score (5)"); now
 * the description does the talking, which is what it is for.
 */

definePageMeta({ requiresAuth: true, middleware: 'auth' })

const api = useApi()
const {
  data: achievements,
  isLoading,
  execute: loadAchievements,
} = useAsync(() => api.achievements.getMine())

onMounted(loadAchievements)

const allAchievements = computed(() => Object.values(ACHIEVEMENTS))

const earnedByType = computed(() => {
  // Dates arrive as ISO strings over JSON regardless of what the type says.
  const map = new Map<string, { earnedAt?: string | Date }>()
  for (const achievement of achievements.value ?? []) {
    map.set(achievement.achievementType, achievement)
  }
  return map
})

const earned = computed(() =>
  allAchievements.value
    .filter((a) => earnedByType.value.has(a.type))
    .map((a) => ({ ...a, earnedAt: earnedByType.value.get(a.type)?.earnedAt }))
)

const remaining = computed(() =>
  allAchievements.value.filter((a) => !earnedByType.value.has(a.type))
)
</script>

<template>
  <div class="container max-w-3xl py-10 md:py-14">
    <p class="eyebrow mb-2">achievements</p>
    <h1 class="display text-2xl md:text-3xl mb-2">Things that have happened.</h1>
    <p class="mb-10 font-mono text-sm text-muted-foreground">
      {{ earned.length }} of {{ allAchievements.length }} — the rest are listed with what would make
      them happen.
    </p>

    <div v-if="isLoading" role="status">
      <div class="h-20 animate-pulse rounded border border-rule bg-muted/50" aria-hidden="true" />
      <span class="sr-only">Loading achievements…</span>
    </div>

    <template v-else>
      <template v-if="earned.length > 0">
        <p class="eyebrow mb-3">earned</p>
        <div class="mb-10 border border-rule">
          <div
            v-for="achievement in earned"
            :key="achievement.type"
            class="flex items-baseline gap-4 border-b border-rule px-4 py-3 last:border-b-0"
          >
            <span class="shrink-0 text-lg" aria-hidden="true">{{ achievement.icon }}</span>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium">{{ achievement.title }}</p>
              <p class="text-xs text-muted-foreground">{{ achievement.description }}</p>
            </div>
            <span v-if="achievement.earnedAt" class="shrink-0 font-mono text-xs text-pass">
              {{ new Date(achievement.earnedAt).toLocaleDateString() }}
            </span>
          </div>
        </div>
      </template>

      <div v-else class="mb-10 max-w-md">
        <p class="mb-4 text-sm leading-relaxed text-muted-foreground">
          Nothing yet — these arrive on their own while you practice, which is the only way they
          mean anything.
        </p>
        <NuxtLink to="/tracks"><Button size="sm">Practice something</Button></NuxtLink>
      </div>

      <p class="eyebrow mb-3">not yet</p>
      <div class="border border-rule">
        <div
          v-for="achievement in remaining"
          :key="achievement.type"
          class="flex items-baseline gap-4 border-b border-rule px-4 py-3 last:border-b-0"
        >
          <span class="shrink-0 text-lg opacity-40" aria-hidden="true">{{ achievement.icon }}</span>
          <div class="min-w-0 flex-1">
            <p class="text-sm text-muted-foreground">{{ achievement.title }}</p>
            <!-- The description IS the requirement, in words. -->
            <p class="text-xs text-muted-foreground/70">{{ achievement.description }}</p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
