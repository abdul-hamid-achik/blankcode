import { defineStore } from 'pinia'
import { DEFAULT_EDITOR_THEME } from '~/utils/editor-themes'

interface EditorPreferences {
  theme: 'dark' | 'light'
  fontSize: number
  tabSize: number
  wordWrap: boolean
  minimap: boolean
  /** Desktop sidebar hidden by choice. The drawer below lg is unaffected. */
  sidebarCollapsed: boolean
  /** CodeMirror color theme id, or 'auto' to follow `theme`. */
  editorTheme: string
}

const defaultPreferences: EditorPreferences = {
  theme: 'dark',
  fontSize: 14,
  tabSize: 2,
  wordWrap: false,
  minimap: false,
  sidebarCollapsed: false,
  editorTheme: DEFAULT_EDITOR_THEME,
}

export const usePreferencesStore = defineStore('preferences', () => {
  const stored = useCookie<EditorPreferences>('blankcode-preferences', {
    default: () => ({ ...defaultPreferences }),
  })
  const preferences = ref<EditorPreferences>({ ...defaultPreferences, ...stored.value })

  watch(
    preferences,
    (newPrefs) => {
      stored.value = newPrefs
    },
    { deep: true }
  )

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
  function toggleSidebar() {
    preferences.value.sidebarCollapsed = !preferences.value.sidebarCollapsed
  }
  function setEditorTheme(id: string) {
    preferences.value.editorTheme = id
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
    toggleSidebar,
    setEditorTheme,
    reset,
  }
})
