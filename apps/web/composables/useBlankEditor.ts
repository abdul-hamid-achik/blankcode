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

    // Compute width in ch units
    const widthChars = Math.max(this.blank.placeholder.length, this.value.length, 3) + 2
    input.style.width = `${widthChars}ch`

    // Set data-state for CSS styling
    this.updateDataState(input)

    // Input event
    input.addEventListener('input', () => {
      this.onInput(this.blank.id, input.value)
    })

    // Keydown for Tab navigation and Ctrl+Enter submit
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault()
        e.stopPropagation()
        this.focusAdjacentBlank(view, input, e.shiftKey)
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

  private focusAdjacentBlank(view: EditorView, current: HTMLInputElement, reverse: boolean) {
    const allInputs = Array.from(view.dom.querySelectorAll<HTMLInputElement>('.cm-blank-input'))
    const currentIndex = allInputs.indexOf(current)
    if (currentIndex === -1) return

    const nextIndex = reverse
      ? (currentIndex - 1 + allInputs.length) % allInputs.length
      : (currentIndex + 1) % allInputs.length
    allInputs[nextIndex]?.focus()
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

/**
 * Extract blank values from saved code by comparing against the fixed text segments.
 * This reverse-engineers user values from a previously reconstructed code string.
 */
export function extractBlankValues(
  savedCode: string,
  starterCode: string,
  blanks: BlankRegionInStarter[]
): Map<string, string> {
  const values = new Map<string, string>()
  if (blanks.length === 0) return values

  // Sort blanks by position
  const sorted = [...blanks].sort((a, b) => a.from - b.from)

  // Build fixed segments between blanks
  let savedOffset = 0
  let starterOffset = 0

  for (const blank of sorted) {
    // Fixed text before this blank (same in both starter and saved)
    const fixedLength = blank.from - starterOffset

    // Skip past the fixed segment in saved code
    savedOffset += fixedLength

    // The value in the saved code occupies the space where the placeholder was.
    // To find where it ends, we look for the next fixed segment.

    // Find next blank or end of string
    const nextBlankIdx = sorted.indexOf(blank) + 1
    const nextBlank = sorted[nextBlankIdx]
    const nextFixedSegment = nextBlank
      ? starterCode.slice(blank.to, nextBlank.from)
      : starterCode.slice(blank.to)

    let valueEnd: number
    if (nextFixedSegment.length > 0) {
      const fixedPos = savedCode.indexOf(nextFixedSegment, savedOffset)
      valueEnd = fixedPos !== -1 ? fixedPos : savedOffset
    } else {
      valueEnd = savedCode.length
    }

    const value = savedCode.slice(savedOffset, valueEnd)
    values.set(blank.id, value)

    savedOffset = valueEnd
    starterOffset = blank.to
  }

  return values
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
