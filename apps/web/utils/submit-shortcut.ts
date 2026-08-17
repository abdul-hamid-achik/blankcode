/** Labels for the exercise action bar. Same tokens the page binds. */

export function submitShortcutLabel(platform: string): string {
  return /Mac|iPhone|iPad/i.test(platform) ? '⌘↵' : 'Ctrl+↵'
}

export function runShortcutLabel(platform: string): string {
  return /Mac|iPhone|iPad/i.test(platform) ? '⌘⇧↵' : 'Ctrl+Shift+↵'
}

export function editorFooterShortcut(platform: string): string {
  return `${submitShortcutLabel(platform)} submits · ${runShortcutLabel(platform)} runs`
}
