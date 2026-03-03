<script setup lang="ts">
import { ACHIEVEMENTS } from '@blankcode/shared'
import { computed } from 'vue'
import Button from '~/components/ui/button.vue'
import Card from '~/components/ui/card.vue'
import { useAsync } from '~/composables/useAsync'

definePageMeta({ requiresAuth: true, middleware: 'auth' })

const api = useApi()
const { data: achievements, isLoading } = useAsync(() => api.achievements.getMine())

const allAchievements = computed(() => {
  return Object.values(ACHIEVEMENTS)
})

const earnedAchievements = computed(() => {
  if (!achievements.value) return []
  return achievements.value
})

const earnedTypes = computed(() => {
  return new Set(earnedAchievements.value.map((a) => a.achievementType))
})

const progress = computed(() => {
  const total = allAchievements.value.length
  const earned = earnedAchievements.value.length
  return { total, earned, percentage: total > 0 ? Math.round((earned / total) * 100) : 0 }
})

const groupedAchievements = computed(() => {
  const groups: Record<string, any[]> = {
    earned: [],
    locked: [],
  }

  for (const achievement of allAchievements.value) {
    if (earnedTypes.value.has(achievement.type)) {
      groups.earned.push({
        ...achievement,
        earnedAt: earnedAchievements.value.find((a) => a.achievementType === achievement.type)
          ?.earnedAt,
      })
    } else {
      groups.locked.push(achievement)
    }
  }

  return groups
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-background to-muted/20">
    <!-- Hero Section -->
    <div class="border-b border-border bg-gradient-to-r from-yellow-500/10 via-orange-500/5 to-red-500/10">
      <div class="container py-16">
        <div class="max-w-3xl">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm mb-4">
            <span>🏅</span>
            <span>Your Achievements</span>
          </div>
          <h1 class="text-4xl md:text-5xl font-bold mb-4">
            Achievement Showcase
          </h1>
          <p class="text-lg text-muted-foreground mb-6">
            Track your progress and earn badges as you complete challenges and master new skills.
          </p>
          
          <!-- Progress Bar -->
          <div class="bg-muted rounded-full h-4 mb-4 overflow-hidden">
            <div
              class="h-full bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 transition-all duration-500"
              :style="{ width: `${progress.percentage}%` }"
            ></div>
          </div>
          <div class="flex justify-between text-sm text-muted-foreground">
            <span>{{ progress.earned }} of {{ progress.total }} achievements earned</span>
            <span>{{ progress.percentage }}%</span>
          </div>
        </div>
      </div>
    </div>

    <div class="container py-8">
      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <div class="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>

      <div v-else>
        <!-- Earned Achievements -->
        <div class="mb-12">
          <h2 class="text-2xl font-bold mb-6 flex items-center gap-2">
            <span class="text-3xl">🏆</span>
            Earned Achievements
            <span class="text-sm font-normal text-muted-foreground">({{ groupedAchievements.earned.length }})</span>
          </h2>
          
          <div v-if="groupedAchievements.earned.length === 0" class="text-center py-12 bg-muted/50 rounded-lg">
            <div class="text-6xl mb-4">🔜</div>
            <h3 class="text-xl font-semibold mb-2">No achievements yet</h3>
            <p class="text-muted-foreground mb-4">Complete challenges to earn your first achievement!</p>
            <NuxtLink to="/challenges">
              <Button>Browse Challenges</Button>
            </NuxtLink>
          </div>
          
          <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card
              v-for="achievement in groupedAchievements.earned"
              :key="achievement.type"
              class="border-green-500/20 bg-green-500/5"
            >
              <div class="p-6">
                <div class="flex items-start justify-between mb-3">
                  <div class="text-5xl">{{ achievement.icon }}</div>
                  <span class="text-xs font-medium px-2 py-1 rounded-full bg-green-500/20 text-green-400">
                    Earned
                  </span>
                </div>
                
                <h3 class="font-bold text-lg mb-1">
                  {{ achievement.title }}
                </h3>
                
                <p class="text-sm text-muted-foreground mb-3">
                  {{ achievement.description }}
                </p>
                
                <div class="text-xs text-muted-foreground">
                  Earned {{ new Date(achievement.earnedAt!).toLocaleDateString() }}
                </div>
              </div>
            </Card>
          </div>
        </div>

        <!-- Locked Achievements -->
        <div>
          <h2 class="text-2xl font-bold mb-6 flex items-center gap-2">
            <span class="text-3xl">🔒</span>
            Locked Achievements
            <span class="text-sm font-normal text-muted-foreground">({{ groupedAchievements.locked.length }})</span>
          </h2>
          
          <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card
              v-for="achievement in groupedAchievements.locked"
              :key="achievement.type"
              class="opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all"
            >
              <div class="p-6">
                <div class="flex items-start justify-between mb-3">
                  <div class="text-5xl filter grayscale">{{ achievement.icon }}</div>
                  <span class="text-xs font-medium px-2 py-1 rounded-full bg-muted text-muted-foreground">
                    🔒 Locked
                  </span>
                </div>
                
                <h3 class="font-bold text-lg mb-1">
                  {{ achievement.title }}
                </h3>
                
                <p class="text-sm text-muted-foreground mb-3">
                  {{ achievement.description }}
                </p>
                
                <div class="text-xs text-muted-foreground">
                  Requirement: {{ achievement.requirement.type.replace('_', ' ') }}
                  <span v-if="achievement.requirement.count">
                    ({{ achievement.requirement.count }})
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
