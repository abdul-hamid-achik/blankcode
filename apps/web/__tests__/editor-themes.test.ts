import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { describe, expect, it } from 'vitest'
import { DEFAULT_EDITOR_THEME, EDITOR_THEMES, resolveEditorTheme } from '~/utils/editor-themes'

function includesOneDark(extension: unknown): boolean {
  return Array.isArray(extension) && extension.includes(oneDark)
}

describe('EDITOR_THEMES registry', () => {
  const entries = Object.entries(EDITOR_THEMES)

  it('is not empty and stays within the curated 6-8 range', () => {
    expect(entries.length).toBeGreaterThanOrEqual(6)
    expect(entries.length).toBeLessThanOrEqual(8)
  })

  it.each(entries)('%s has a label, an appearance, and a working extension', (_id, theme) => {
    expect(typeof theme.label).toBe('string')
    expect(theme.label.length).toBeGreaterThan(0)
    expect(['dark', 'light']).toContain(theme.appearance)
    expect(typeof theme.extension).toBe('function')

    // Verify by building, not by reading: an extension that throws when
    // CodeMirror actually tries to use it is worse than no theme at all.
    expect(() =>
      EditorState.create({ doc: 'const x = 1', extensions: theme.extension() })
    ).not.toThrow()
  })

  it('includes both dark and light themes', () => {
    const appearances = new Set(entries.map(([, theme]) => theme.appearance))
    expect(appearances.has('dark')).toBe(true)
    expect(appearances.has('light')).toBe(true)
  })

  it('does not use "auto" as a curated theme id', () => {
    expect(EDITOR_THEMES[DEFAULT_EDITOR_THEME]).toBeUndefined()
  })
})

describe('resolveEditorTheme', () => {
  it('"auto" on a dark app theme resolves to the same oneDark used before themes existed', () => {
    expect(includesOneDark(resolveEditorTheme('auto', 'dark'))).toBe(true)
  })

  it('"auto" on a light app theme does not pull in oneDark', () => {
    expect(includesOneDark(resolveEditorTheme('auto', 'light'))).toBe(false)
  })

  it('an unrecognized stored id falls back exactly like "auto"', () => {
    expect(includesOneDark(resolveEditorTheme('theme-that-was-retired', 'dark'))).toBe(true)
    expect(includesOneDark(resolveEditorTheme('theme-that-was-retired', 'light'))).toBe(false)
  })

  it('undefined (never chosen) falls back like "auto"', () => {
    expect(includesOneDark(resolveEditorTheme(undefined, 'dark'))).toBe(true)
  })

  it('a known curated id resolves to its own extension, not the auto fallback', () => {
    const [id] = Object.keys(EDITOR_THEMES)
    const resolved = resolveEditorTheme(id, 'dark')
    expect(includesOneDark(resolved)).toBe(false)
    expect(() => EditorState.create({ doc: 'const x = 1', extensions: resolved })).not.toThrow()
  })

  it('every curated theme resolves cleanly regardless of the app theme', () => {
    for (const id of Object.keys(EDITOR_THEMES)) {
      for (const appTheme of ['dark', 'light'] as const) {
        expect(() =>
          EditorState.create({ doc: 'const x = 1', extensions: resolveEditorTheme(id, appTheme) })
        ).not.toThrow()
      }
    }
  })
})

describe('CodeMirror surfaces read the registry instead of hardcoding a theme', () => {
  const codeEditorSource = readFileSync(
    join(process.cwd(), 'components/editor/code-editor.vue'),
    'utf-8'
  )
  const codeViewSource = readFileSync(
    join(process.cwd(), 'components/reading/code-view.vue'),
    'utf-8'
  )

  it.each([
    ['code-editor.vue', codeEditorSource],
    ['code-view.vue', codeViewSource],
  ])('%s imports resolveEditorTheme from the registry', (_name, source) => {
    expect(source).toContain("from '~/utils/editor-themes'")
    expect(source).toContain('resolveEditorTheme')
  })

  it.each([
    ['code-editor.vue', codeEditorSource],
    ['code-view.vue', codeViewSource],
  ])('%s no longer imports oneDark directly', (_name, source) => {
    expect(source).not.toContain('@codemirror/theme-one-dark')
  })
})
