import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { tags } from '@lezer/highlight'
import {
  amy,
  ayuLight,
  barf,
  bespin,
  birdsOfParadise,
  clouds,
  cobalt,
  coolGlow,
  createTheme,
  dracula,
  espresso,
  noctisLilac,
  rosePineDawn,
  smoothy,
  solarizedLight,
  tomorrow,
} from 'thememirror'

/**
 * Editor color themes, chosen in Settings and shared by both CodeMirror
 * surfaces (the exercise editor and the read-only reading viewer).
 *
 * `background`/`foreground` are read straight from each theme's own
 * `createTheme` settings (thememirror does not re-export them) — they exist
 * only so a Settings swatch can show the real colors before a click applies
 * anything.
 */
export interface EditorThemeDefinition {
  label: string
  appearance: 'dark' | 'light'
  background: string
  foreground: string
  extension: () => Extension
}

// Every curated theme carries the same fallback highlighter the site has
// always used for tags a theme's own `styles` list does not cover, so
// switching themes never drops a token back to unstyled text.
function withFallback(theme: Extension): Extension {
  return [theme, syntaxHighlighting(defaultHighlightStyle, { fallback: true })]
}

/**
 * Nord, hand-built from the official palette (nordtheme.com) with
 * thememirror's own `createTheme`. The published @uiw Nord package drags a
 * broken @babel/runtime resolution into this workspace; sixteen hex values
 * we control beat a dependency we have to apologize for.
 */
const nord: Extension = createTheme({
  variant: 'dark',
  settings: {
    background: '#2e3440',
    foreground: '#d8dee9',
    caret: '#d8dee9',
    selection: '#434c5e',
    lineHighlight: '#3b4252',
    gutterBackground: '#2e3440',
    gutterForeground: '#4c566a',
  },
  styles: [
    { tag: tags.comment, color: '#616e88' },
    { tag: [tags.keyword, tags.operator, tags.modifier], color: '#81a1c1' },
    { tag: [tags.string, tags.special(tags.string)], color: '#a3be8c' },
    { tag: [tags.number, tags.bool, tags.null], color: '#b48ead' },
    { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: '#88c0d0' },
    { tag: [tags.typeName, tags.className, tags.namespace], color: '#8fbcbb' },
    { tag: [tags.definition(tags.variableName), tags.propertyName], color: '#d8dee9' },
    { tag: [tags.attributeName, tags.tagName], color: '#81a1c1' },
    { tag: tags.invalid, color: '#bf616a' },
  ],
})

export const EDITOR_THEMES: Record<string, EditorThemeDefinition> = {
  nord: {
    label: 'Nord',
    appearance: 'dark',
    background: '#2e3440',
    foreground: '#d8dee9',
    extension: () => withFallback(nord),
  },
  dracula: {
    label: 'Dracula',
    appearance: 'dark',
    background: '#2d2f3f',
    foreground: '#f8f8f2',
    extension: () => withFallback(dracula),
  },
  cobalt: {
    label: 'Cobalt',
    appearance: 'dark',
    background: '#00254b',
    foreground: '#ffffff',
    extension: () => withFallback(cobalt),
  },
  amy: {
    label: 'Amy',
    appearance: 'dark',
    background: '#200020',
    foreground: '#d0d0ff',
    extension: () => withFallback(amy),
  },
  coolGlow: {
    label: 'Cool Glow',
    appearance: 'dark',
    background: '#060521',
    foreground: '#e0e0e0',
    extension: () => withFallback(coolGlow),
  },
  ayuLight: {
    label: 'Ayu Light',
    appearance: 'light',
    background: '#fcfcfc',
    foreground: '#5c6166',
    extension: () => withFallback(ayuLight),
  },
  solarizedLight: {
    label: 'Solarized Light',
    appearance: 'light',
    background: '#fef7e5',
    foreground: '#586e75',
    extension: () => withFallback(solarizedLight),
  },
  rosePineDawn: {
    label: 'Rosé Pine Dawn',
    appearance: 'light',
    background: '#faf4ed',
    foreground: '#575279',
    extension: () => withFallback(rosePineDawn),
  },
  noctisLilac: {
    label: 'Noctis Lilac',
    appearance: 'light',
    background: '#f2f1f8',
    foreground: '#0c006b',
    extension: () => withFallback(noctisLilac),
  },
  barf: {
    label: 'Barf',
    appearance: 'dark',
    background: '#15191e',
    foreground: '#a4b1cd',
    extension: () => withFallback(barf),
  },
  bespin: {
    label: 'Bespin',
    appearance: 'dark',
    background: '#28211c',
    foreground: '#9d9b97',
    extension: () => withFallback(bespin),
  },
  birdsOfParadise: {
    label: 'Birds of Paradise',
    appearance: 'dark',
    background: '#3b2627',
    foreground: '#e6e1c4',
    extension: () => withFallback(birdsOfParadise),
  },
  clouds: {
    label: 'Clouds',
    appearance: 'light',
    background: '#ffffff',
    foreground: '#000000',
    extension: () => withFallback(clouds),
  },
  espresso: {
    label: 'Espresso',
    appearance: 'light',
    background: '#ffffff',
    foreground: '#000000',
    extension: () => withFallback(espresso),
  },
  smoothy: {
    label: 'Smoothy',
    appearance: 'light',
    background: '#ffffff',
    foreground: '#000000',
    extension: () => withFallback(smoothy),
  },
  tomorrow: {
    label: 'Tomorrow',
    appearance: 'light',
    background: '#ffffff',
    foreground: '#4d4d4c',
    extension: () => withFallback(tomorrow),
  },
}

/**
 * The default, and the fallback for a stored id that no longer exists (a
 * theme retired from the registry). Not itself a key in `EDITOR_THEMES`
 * because it has no fixed appearance — it takes whichever the app theme is.
 */
export const DEFAULT_EDITOR_THEME = 'auto'

/**
 * Resolves a stored preference plus the current app theme into the
 * CodeMirror extension to install. 'auto' (and any unrecognized id)
 * reproduces exactly what the editor rendered before themes existed: oneDark
 * for a dark app theme, the bare default highlight style for a light one —
 * so nobody's editor changes in appearance until they actually pick one.
 */
export function resolveEditorTheme(
  stored: string | undefined,
  appTheme: 'dark' | 'light'
): Extension {
  const theme = stored ? EDITOR_THEMES[stored] : undefined
  if (!theme) {
    return appTheme === 'dark'
      ? [oneDark, syntaxHighlighting(defaultHighlightStyle, { fallback: true })]
      : [syntaxHighlighting(defaultHighlightStyle, { fallback: true })]
  }
  return theme.extension()
}
