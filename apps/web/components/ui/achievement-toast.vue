<script setup lang="ts">
import { useAchievementNotifications } from '~/composables/useAchievementNotifications'

const { notifications, dismissNotification } = useAchievementNotifications()
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-4 right-4 z-50 space-y-2">
      <TransitionGroup
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="translate-x-full opacity-0"
        enter-to-class="translate-x-0 opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="translate-x-0 opacity-100"
        leave-to-class="translate-x-full opacity-0"
      >
        <div
          v-for="notification in notifications"
          :key="notification.id"
          class="max-w-sm w-full bg-background border border-border rounded-lg shadow-lg overflow-hidden"
          :style="{ borderLeftWidth: '4px', borderLeftColor: notification.color }"
        >
          <div class="p-4">
            <div class="flex items-start gap-3">
              <div class="text-3xl">{{ notification.icon }}</div>
              <div class="flex-1">
                <h4 class="font-semibold mb-1">{{ notification.title }}</h4>
                <p class="text-sm text-muted-foreground">{{ notification.description }}</p>
              </div>
              <button
                class="text-muted-foreground hover:text-foreground transition-colors"
                @click="dismissNotification(notification.id)"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div class="h-1 bg-muted">
            <div
              class="h-full animate-progress"
              :style="{ backgroundColor: notification.color }"
            ></div>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style>
@keyframes progress {
  from {
    width: 100%;
  }
  to {
    width: 0%;
  }
}

.animate-progress {
  animation: progress 5s linear forwards;
}
</style>
