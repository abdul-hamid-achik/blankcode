import { computed, watch } from 'vue'
import { usePreferencesStore } from '~/stores/preferences'

/**
 * Keeps the `dark` class on <html> in sync with the stored preference.
 *
 * Needed in both `app.vue` and `error.vue`: the error page replaces the whole
 * app tree, so it does not inherit anything the layout set up.
 */
export function useThemeClass() {
  const preferences = usePreferencesStore()
  const isDark = computed(() => preferences.preferences.theme === 'dark')

  useHead({
    htmlAttrs: {
      class: computed(() => (isDark.value ? 'dark' : '')),
    },
  })

  watch(
    isDark,
    (dark) => {
      if (!import.meta.client) return
      document.documentElement.classList.toggle('dark', dark)
    },
    { immediate: true }
  )

  return { isDark }
}
