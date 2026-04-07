import type { Ref } from 'vue'

export interface AchievementNotification {
  id: string
  type: string
  title: string
  description: string
  icon: string
  color: string
}

const notifications: Ref<AchievementNotification[]> = ref([])

export function useAchievementNotifications() {
  const showNotification = (achievement: AchievementNotification) => {
    const notification = {
      ...achievement,
      id: Math.random().toString(36).substring(7),
    }

    notifications.value.push(notification)

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      dismissNotification(notification.id)
    }, 5000)
  }

  const dismissNotification = (id: string) => {
    notifications.value = notifications.value.filter((n) => n.id !== id)
  }

  const showAchievementUnlocked = (achievement: {
    title: string
    description: string
    icon: string
    color: string
  }) => {
    showNotification({
      id: Math.random().toString(36).substring(7),
      type: 'achievement',
      title: 'Achievement Unlocked!',
      description: achievement.title,
      icon: achievement.icon,
      color: achievement.color,
    })
  }

  return {
    notifications,
    showNotification,
    dismissNotification,
    showAchievementUnlocked,
  }
}
