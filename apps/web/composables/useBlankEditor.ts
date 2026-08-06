import type { BlankRegionInStarter } from '@blankcode/shared'
import { type Extension, type Range, StateEffect, StateField } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  keymap,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from '@codemirror/view'

// --- State Effects ---

const updateBlankValue = StateEffect.define<{ id: string; value: string }>()
const setBlankFeedback = StateEffect.define<Map<string, 'correct' | 'incorrect'>>()
const clearFeedback = StateEffect.define<void>()

// --- State Field ---

interface BlankState {
  values: Map<string, string>
  feedback: Map<string, 'correct' | 'incorrect'>
}

function createBlankStateField(initialValues: Map<string, string>) {
  return StateField.define<BlankState>({
    create() {
      return {
        values: new Map(initialValues),
        feedback: new Map(),
      }
    },
    update(state, tr) {
      let changed = false
      let values = state.values
      let feedback = state.feedback

      for (const effect of tr.effects) {
        if (effect.is(updateBlankValue)) {
          const newValues = new Map(values)
          newValues.set(effect.value.id, effect.value.value)
          values = newValues
          changed = true
        } else if (effect.is(setBlankFeedback)) {
          feedback = effect.value
          changed = true
        } else if (effect.is(clearFeedback)) {
          feedback = new Map()
          changed = true
        }
      }

      return changed ? { values, feedback } : state
    },
  })
}

// --- Widget ---

class BlankWidget extends WidgetType {
  constructor(
    readonly blank: BlankRegionInStarter,
    readonly value: string,
    readonly feedbackState: 'correct' | 'incorrect' | undefined,
    readonly onInput: (id: string, value: string) => void,
    readonly onSubmit: () => void
  ) {
    super()
  }

  override eq(other: BlankWidget): boolean {
    return (
      this.blank.id === other.blank.id &&
      this.value === other.value &&
      this.feedbackState === other.feedbackState
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement('span')
    wrapper.className = 'cm-blank-widget'

    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'cm-blank-input'
    input.dataset['blankId'] = this.blank.id
    input.value = this.value
    input.placeholder = this.blank.placeholder
    input.spellcheck = false
    input.autocomplete = 'off'
    input.setAttribute('aria-label', `Blank: ${this.blank.placeholder || this.blank.id}`)
    if (this.feedbackState === 'incorrect') {
      input.setAttribute('aria-invalid', 'true')
    }

    // Compute width in ch units
    const widthChars = Math.max(this.blank.placeholder.length, this.value.length, 3) + 2
    input.style.width = `${widthChars}ch`

    // Set data-state for CSS styling
    this.updateDataState(input)

    // Input event
    input.addEventListener('input', () => {
      this.onInput(this.blank.id, input.value)
    })

    // Keydown for Tab navigation between blanks (only intercept when there's
    // another blank to move to — at the boundaries, let the browser's default
    // Tab behavior take over so focus can leave the editor).
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        const moved = this.focusAdjacentBlank(view, input, e.shiftKey)
        if (moved) {
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        this.onSubmit()
      }
    })

    // Update data-state on focus/blur
    input.addEventListener('focus', () => {
      if (!this.feedbackState) {
        input.dataset['state'] = 'focused'
      }
    })

    input.addEventListener('blur', () => {
      this.updateDataState(input)
    })

    wrapper.appendChild(input)
    return wrapper
  }

  private focusAdjacentBlank(
    view: EditorView,
    current: HTMLInputElement,
    reverse: boolean
  ): boolean {
    const allInputs = Array.from(view.dom.querySelectorAll<HTMLInputElement>('.cm-blank-input'))
    const currentIndex = allInputs.indexOf(current)
    if (currentIndex === -1) return false

    const nextIndex = reverse ? currentIndex - 1 : currentIndex + 1
    if (nextIndex < 0 || nextIndex >= allInputs.length) {
      // Boundary — let the browser handle Tab so focus leaves the editor.
      return false
    }
    allInputs[nextIndex]?.focus()
    return true
  }

  private updateDataState(input: HTMLInputElement) {
    if (this.feedbackState) {
      input.dataset['state'] = this.feedbackState
    } else if (this.value.length > 0) {
      input.dataset['state'] = 'filled'
    } else {
      input.dataset['state'] = 'empty'
    }
  }

  override ignoreEvent(): boolean {
    return true
  }
}

// --- View Plugin (builds decorations) ---

function createBlankDecoPlugin(
  blanks: BlankRegionInStarter[],
  stateField: StateField<BlankState>,
  onInput: (id: string, value: string) => void,
  onSubmit: () => void
) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view)
      }

      update(update: ViewUpdate) {
        // Rebuild on any effect that touches our state field
        if (
          update.transactions.some((tr) =>
            tr.effects.some(
              (e) => e.is(updateBlankValue) || e.is(setBlankFeedback) || e.is(clearFeedback)
            )
          )
        ) {
          this.decorations = this.buildDecorations(update.view)
        }
      }

      buildDecorations(view: EditorView): DecorationSet {
        const state = view.state.field(stateField)
        const decos: Range<Decoration>[] = []

        for (const blank of blanks) {
          const from = blank.from
          const to = blank.to
          if (from < 0 || to > view.state.doc.length) continue

          // A replace decoration may not span a line break. If the offsets no
          // longer line up with the document, skip the widget instead of
          // throwing — a missing blank is recoverable, a dead editor is not.
          if (view.state.doc.lineAt(from).number !== view.state.doc.lineAt(to).number) {
            continue
          }

          const value = state.values.get(blank.id) ?? ''
          const feedback = state.feedback.get(blank.id)

          const widget = new BlankWidget(blank, value, feedback, onInput, onSubmit)
          decos.push(
            Decoration.replace({
              widget,
              inclusive: false,
            }).range(from, to)
          )
        }

        return Decoration.set(decos, true)
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  )
}

// --- Blank mode theme (hides cursor) ---
const blankModeTheme = EditorView.theme({
  '&': {
    '&.cm-focused .cm-cursor': {
      display: 'none',
    },
    '&.cm-focused .cm-selectionBackground': {
      backgroundColor: 'transparent',
    },
  },
})

// --- Factory ---

export interface CreateBlankExtensionsOptions {
  blanks: BlankRegionInStarter[]
  initialValues: Map<string, string>
  onValuesChange: (values: Map<string, string>) => void
  onSubmit: () => void
}

export interface BlankExtensionsResult {
  extensions: Extension[]
  stateField: StateField<BlankState>
}

export function createBlankExtensions(
  options: CreateBlankExtensionsOptions
): BlankExtensionsResult {
  const { blanks, initialValues, onValuesChange, onSubmit } = options

  const field = createBlankStateField(initialValues)

  // Store view reference so widget input handlers can dispatch effects
  let viewRef: EditorView | null = null

  function handleInputDirect(id: string, value: string) {
    if (!viewRef) return
    viewRef.dispatch({
      effects: updateBlankValue.of({ id, value }),
    })
    // Read updated state and notify
    const state = viewRef.state.field(field)
    const newValues = new Map(state.values)
    newValues.set(id, value)
    onValuesChange(newValues)
  }

  const viewRefPlugin = ViewPlugin.fromClass(
    class {
      constructor(view: EditorView) {
        viewRef = view
      }
      destroy() {
        viewRef = null
      }
    }
  )

  const decoPlugin = createBlankDecoPlugin(blanks, field, handleInputDirect, onSubmit)

  // Tab keymap within the editor for blank navigation
  const blankKeymap = keymap.of([
    {
      key: 'Tab',
      run: (view) => {
        const firstInput = view.dom.querySelector<HTMLInputElement>('.cm-blank-input')
        if (firstInput) {
          firstInput.focus()
          return true
        }
        return false
      },
    },
    {
      key: 'Ctrl-Enter',
      mac: 'Cmd-Enter',
      run: () => {
        onSubmit()
        return true
      },
    },
  ])

  // Add the cm-blank-mode class to the editor
  const blankModeClass = EditorView.editorAttributes.of({ class: 'cm-blank-mode' })

  const extensions: Extension[] = [
    field,
    viewRefPlugin,
    decoPlugin,
    blankKeymap,
    blankModeTheme,
    blankModeClass,
    EditorView.contentAttributes.of({ tabindex: '-1' }),
  ]

  return { extensions, stateField: field }
}

// --- Helper functions ---

/**
 * Reconstruct full code from starter code by replacing blank placeholders with user values.
 */
export function reconstructCode(
  starterCode: string,
  blanks: BlankRegionInStarter[],
  values: Map<string, string>
): string {
  // Process blanks in reverse order of position to avoid offset shifts
  const sorted = [...blanks].sort((a, b) => b.from - a.from)
  let result = starterCode

  for (const blank of sorted) {
    const value = values.get(blank.id) ?? blank.placeholder
    result = result.slice(0, blank.from) + value + result.slice(blank.to)
  }

  return result
}

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Recover the values a user typed from a previously reconstructed code string.
 *
 * The starter is `F0 B0 F1 B1 ... Fn`, where `F` are fixed segments and `B` are
 * blanks; the saved code is the same with each `B` replaced by the user's text.
 *
 * The previous implementation walked forward calling `indexOf` for each next
 * fixed segment, which silently truncated any value that happened to contain
 * that segment — typing `f(x)` into a blank followed by `)` cut the value to
 * `f(x`. Because drafts are saved as reconstructed code and re-extracted on
 * load, that truncation compounded on every reload and corrupted real work.
 *
 * Anchoring the whole thing as one regex over the full string fixes it: the
 * engine backtracks so that *every* fixed segment lines up, including the tail,
 * instead of committing to the first plausible match for each one.
 */
export function extractBlankValues(
  savedCode: string,
  starterCode: string,
  blanks: BlankRegionInStarter[]
): Map<string, string> {
  const values = new Map<string, string>()
  if (blanks.length === 0) return values

  const sorted = [...blanks].sort((a, b) => a.from - b.from)

  // Split the starter into the fixed segments surrounding each blank.
  const fixedSegments: string[] = []
  let cursor = 0
  for (const blank of sorted) {
    fixedSegments.push(starterCode.slice(cursor, blank.from))
    cursor = blank.to
  }
  fixedSegments.push(starterCode.slice(cursor))

  const pattern = fixedSegments.map(escapeRegExp).join('([\\s\\S]*?)')
  const match = new RegExp(`^${pattern}$`).exec(savedCode)

  if (match) {
    sorted.forEach((blank, i) => values.set(blank.id, match[i + 1] ?? ''))
    return values
  }

  // The saved code no longer matches the starter's fixed text — usually a
  // stale draft from before the exercise was edited. Recovering half of it
  // would silently mangle the user's work, so start clean instead.
  return new Map()
}

/**
 * Dispatch feedback effects on a view after submission.
 */
export function setBlankFeedbackOnView(
  view: EditorView,
  feedback: Map<string, 'correct' | 'incorrect'>,
  stateField: StateField<BlankState>
): void {
  view.dispatch({
    effects: setBlankFeedback.of(feedback),
  })
}

/**
 * Clear feedback effects on a view.
 */
export function clearBlankFeedbackOnView(
  view: EditorView,
  stateField: StateField<BlankState>
): void {
  view.dispatch({
    effects: clearFeedback.of(undefined),
  })
}
