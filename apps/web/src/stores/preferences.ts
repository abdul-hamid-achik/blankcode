import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

interface EditorPreferences {
  theme: 'dark' | 'light'
  fontSize: number
  tabSize: number
  wordWrap: boolean
  minimap: boolean
}

const STORAGE_KEY = 'blankcode:preferences'

const defaultPreferences: EditorPreferences = {
  theme: 'dark',
  fontSize: 14,
  tabSize: 2,
  wordWrap: false,
  minimap: false,
}

function loadFromStorage(): EditorPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return { ...defaultPreferences, ...JSON.parse(stored) }
    }
  } catch {
    // Ignore parse errors
  }
  return defaultPreferences
}

function saveToStorage(prefs: EditorPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Ignore storage errors
  }
}

export const usePreferencesStore = defineStore('preferences', () => {
  const preferences = ref<EditorPreferences>(loadFromStorage())

  watch(preferences, (newPrefs) => {
    saveToStorage(newPrefs)
  }, { deep: true })

  function setTheme(theme: 'dark' | 'light') {
    preferences.value.theme = theme
  }

  function setFontSize(size: number) {
    preferences.value.fontSize = Math.max(10, Math.min(24, size))
  }

  function setTabSize(size: number) {
    preferences.value.tabSize = Math.max(2, Math.min(8, size))
  }

  function toggleWordWrap() {
    preferences.value.wordWrap = !preferences.value.wordWrap
  }

  function toggleMinimap() {
    preferences.value.minimap = !preferences.value.minimap
  }

  function reset() {
    preferences.value = { ...defaultPreferences }
  }

  return {
    preferences,
    setTheme,
    setFontSize,
    setTabSize,
    toggleWordWrap,
    toggleMinimap,
    reset,
  }
})
