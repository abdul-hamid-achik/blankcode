import { type BlankRegionInStarter, extractBlankValues, reconstructCode } from '@blankcode/shared'
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

/**
 * Derive the input's visual state and width from the DOM itself. Reading the
 * live element — not widget fields — matters: CodeMirror reuses the DOM across
 * widget instances, so the instance a listener closed over goes stale while
 * the element it reads from never does.
 */
function applyVisualState(input: HTMLInputElement, placeholder: string): void {
  const feedback = input.dataset['feedback']
  if (feedback === 'correct' || feedback === 'incorrect') {
    input.dataset['state'] = feedback
  } else if (document.activeElement === input) {
    input.dataset['state'] = 'focused'
  } else if (input.value.length > 0) {
    input.dataset['state'] = 'filled'
  } else {
    input.dataset['state'] = 'empty'
  }

  // Sized to whichever is longer, placeholder or answer, so the slot grows
  // under the mark instead of clipping it.
  const widthChars = Math.max(placeholder.length, input.value.length, 3) + 2
  input.style.width = `${widthChars}ch`
}

function focusAdjacentBlank(
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

export class BlankWidget extends WidgetType {
  constructor(
    readonly blank: BlankRegionInStarter,
    readonly value: string,
    readonly feedbackState: 'correct' | 'incorrect' | undefined,
    readonly onInput: (id: string, value: string) => void,
    readonly onSubmit: () => void
  ) {
    super()
  }

  /**
   * Equality decides whether CodeMirror may keep the existing DOM untouched.
   * The typed value is deliberately NOT compared: the user's keystrokes live
   * in the `<input>` itself, and treating them as a difference tore the input
   * down on every keystroke — killing focus, caret, and characters with it.
   * Feedback IS compared, so a grading change falls through to updateDOM.
   */
  override eq(other: BlankWidget): boolean {
    return this.blank.id === other.blank.id && this.feedbackState === other.feedbackState
  }

  /**
   * Called when eq() is false but the same kind of widget occupies the slot.
   * Repair the element in place and return true — that keeps the node, and
   * with it the user's focus, alive.
   */
  override updateDOM(dom: HTMLElement): boolean {
    const input = dom.querySelector<HTMLInputElement>('.cm-blank-input')
    if (!input || input.dataset['blankId'] !== this.blank.id) return false
    this.syncInput(input)
    return true
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

    // These listeners outlive `this`: later widget instances adopt the same
    // DOM, so they capture only stable references and read the rest live.
    const { blank, onInput, onSubmit } = this

    input.addEventListener('input', () => {
      onInput(blank.id, input.value)
      applyVisualState(input, blank.placeholder)
    })

    // Tab moves between blanks (only intercepted when there is another blank
    // to move to — at the boundaries, the browser's default Tab behavior
    // takes over so focus can leave the editor).
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        const moved = focusAdjacentBlank(view, input, e.shiftKey)
        if (moved) {
          e.preventDefault()
          e.stopPropagation()
        }
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        onSubmit()
      }
    })

    input.addEventListener('focus', () => applyVisualState(input, blank.placeholder))
    input.addEventListener('blur', () => applyVisualState(input, blank.placeholder))

    this.syncInput(input)
    wrapper.appendChild(input)
    return wrapper
  }

  /** Bring an input up to date with this widget without disturbing the user. */
  private syncInput(input: HTMLInputElement): void {
    // A focused input is the source of truth for its own value — the user is
    // mid-word there, and assigning `.value` resets the caret. Only an
    // unfocused input may be synced from state (e.g. a restored draft).
    if (document.activeElement !== input && input.value !== this.value) {
      input.value = this.value
    }

    if (this.feedbackState) {
      input.dataset['feedback'] = this.feedbackState
    } else {
      delete input.dataset['feedback']
    }
    if (this.feedbackState === 'incorrect') {
      input.setAttribute('aria-invalid', 'true')
    } else {
      input.removeAttribute('aria-invalid')
    }

    applyVisualState(input, this.blank.placeholder)
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

  return { extensions }
}

// --- Helper functions ---

/**
 * Dispatch feedback effects on a view after submission.
 */
export function setBlankFeedbackOnView(
  view: EditorView,
  feedback: Map<string, 'correct' | 'incorrect'>
): void {
  view.dispatch({
    effects: setBlankFeedback.of(feedback),
  })
}

/**
 * Clear feedback effects on a view.
 */
export function clearBlankFeedbackOnView(view: EditorView): void {
  view.dispatch({
    effects: clearFeedback.of(undefined),
  })
}

/**
 * Draft restore: extraction, minus reconstruction's own artifacts.
 *
 * `reconstructCode` writes the placeholder for every untouched blank — it has
 * nothing else to write — so a raw extract of a saved draft resurrects
 * `______` as typed text, and the next keystroke appends to it: the editor
 * shows `______f`. A placeholder-equal value can never be a real answer
 * (authoring forbids answers that start or end with `_`), so dropping it
 * loses nothing.
 */
export function extractDraftBlankValues(
  savedCode: string,
  starterCode: string,
  blanks: readonly BlankRegionInStarter[]
): Map<string, string> {
  const values = extractBlankValues(savedCode, starterCode, blanks)
  for (const blank of blanks) {
    if (values.get(blank.id) === blank.placeholder) {
      values.delete(blank.id)
    }
  }
  return values
}

// Re-exported so callers keep importing blank helpers from one place; the
// implementations live in @blankcode/shared because the API grades against them.
export { extractBlankValues, reconstructCode }
