import type { BlankRegionInStarter } from '@blankcode/shared'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  BlankWidget,
  clearBlankFeedbackOnView,
  createBlankExtensions,
  setBlankFeedbackOnView,
} from '~/composables/useBlankEditor'

/**
 * The blank widget's DOM contract. The `<input>` a user is typing into must be
 * the same element from keystroke to keystroke — if CodeMirror tears it down
 * and rebuilds it, focus and caret die with it and typed characters land out
 * of order or in other blanks. That happened; these tests pin the fix.
 */

const STARTER = 'const nums = ___;\nconst word = ___;'
const FIRST = STARTER.indexOf('___')
const SECOND = STARTER.lastIndexOf('___')

function blank(id: string, from: number, to: number): BlankRegionInStarter {
  return { id, from, to, placeholder: '___' } as BlankRegionInStarter
}

const BLANKS = [blank('b1', FIRST, FIRST + 3), blank('b2', SECOND, SECOND + 3)]

const noop = () => {}

interface Harness {
  view: EditorView
  inputs: () => HTMLInputElement[]
  onValuesChange: ReturnType<typeof vi.fn>
  onSubmit: ReturnType<typeof vi.fn>
}

let active: EditorView | null = null

function mountEditor(initialValues = new Map<string, string>()): Harness {
  const onValuesChange = vi.fn()
  const onSubmit = vi.fn()
  const { extensions } = createBlankExtensions({
    blanks: BLANKS,
    initialValues,
    onValuesChange,
    onSubmit,
  })
  const view = new EditorView({
    state: EditorState.create({
      doc: STARTER,
      extensions: [EditorState.readOnly.of(true), ...extensions],
    }),
    parent: document.body,
  })
  active = view
  return {
    view,
    inputs: () => Array.from(view.dom.querySelectorAll<HTMLInputElement>('.cm-blank-input')),
    onValuesChange,
    onSubmit,
  }
}

/** Simulate real typing: the DOM input already holds the text when the event fires. */
function typeInto(input: HTMLInputElement, text: string) {
  for (const ch of text) {
    input.value += ch
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }
}

afterEach(() => {
  active?.destroy()
  active = null
  document.body.innerHTML = ''
})

describe('blank widget DOM stability', () => {
  it('renders one input per blank', () => {
    const { inputs } = mountEditor()
    expect(inputs()).toHaveLength(2)
  })

  it('keeps the same input element across keystrokes', () => {
    const { inputs } = mountEditor()
    const target = inputs()[0]!
    target.focus()

    typeInto(target, 'numbers')

    const after = inputs()[0]!
    expect(after).toBe(target)
    expect(after.value).toBe('numbers')
  })

  it('keeps focus on the input the user is typing into', () => {
    const { inputs } = mountEditor()
    const target = inputs()[0]!
    target.focus()

    typeInto(target, 'numbers')

    expect(document.activeElement).toBe(target)
  })

  it('reports every keystroke to the values callback, in order', () => {
    const { inputs, onValuesChange } = mountEditor()
    const target = inputs()[0]!
    target.focus()

    typeInto(target, 'abc')

    const typed = onValuesChange.mock.calls.map((call) =>
      (call[0] as Map<string, string>).get('b1')
    )
    expect(typed).toEqual(['a', 'ab', 'abc'])
  })

  it('applies feedback in place without replacing the focused input', () => {
    const { view, inputs } = mountEditor()
    const target = inputs()[0]!
    target.focus()
    typeInto(target, 'numbers')

    setBlankFeedbackOnView(view, new Map([['b1', 'incorrect']]))

    const after = inputs()[0]!
    expect(after).toBe(target)
    expect(after.dataset['state']).toBe('incorrect')
    expect(after.getAttribute('aria-invalid')).toBe('true')
    expect(after.value).toBe('numbers')
    expect(document.activeElement).toBe(target)

    clearBlankFeedbackOnView(view)
    expect(inputs()[0]).toBe(target)
    expect(inputs()[0]!.dataset['state']).not.toBe('incorrect')
    expect(inputs()[0]!.getAttribute('aria-invalid')).toBeNull()
  })

  it('restores draft values into the inputs at creation', () => {
    const { inputs } = mountEditor(new Map([['b1', 'saved']]))
    expect(inputs()[0]!.value).toBe('saved')
    expect(inputs()[0]!.dataset['state']).toBe('filled')
    expect(inputs()[1]!.value).toBe('')
    expect(inputs()[1]!.dataset['state']).toBe('empty')
  })

  it('moves focus between blanks with Tab and Shift-Tab', () => {
    const { inputs } = mountEditor()
    const [first, second] = inputs()
    first!.focus()

    first!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(second)

    second!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })
    )
    expect(document.activeElement).toBe(first)
  })

  it('submits on Ctrl+Enter from inside a blank', () => {
    const { inputs, onSubmit } = mountEditor()
    const target = inputs()[0]!
    target.focus()

    target.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true })
    )
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('grows the input as the value outgrows the placeholder', () => {
    const { inputs } = mountEditor()
    const target = inputs()[0]!
    target.focus()
    expect(target.style.width).toBe('5ch') // max(3, 0, 3) + 2

    typeInto(target, 'numbers')
    expect(target.style.width).toBe('9ch') // max(3, 7, 3) + 2
  })
})

/**
 * The widget contract underneath the behavior above. eq() must never depend
 * on the typed value — a value-sensitive eq() is exactly the bug that made
 * CodeMirror rebuild the input on every keystroke — and updateDOM must exist
 * so non-eq changes (feedback) repair the element instead of replacing it.
 */
describe('BlankWidget contract', () => {
  const b1 = BLANKS[0]!
  const widget = (value: string, feedback?: 'correct' | 'incorrect') =>
    new BlankWidget(b1, value, feedback, noop, noop)

  it('eq() does not depend on the typed value', () => {
    expect(widget('nu').eq(widget('numbers'))).toBe(true)
    expect(widget('').eq(widget('anything at all'))).toBe(true)
  })

  it('eq() is false when feedback changes, so updateDOM gets to repaint', () => {
    expect(widget('x').eq(widget('x', 'incorrect'))).toBe(false)
    expect(widget('x', 'correct').eq(widget('x', 'incorrect'))).toBe(false)
  })

  it('eq() is false for a different blank', () => {
    const other = new BlankWidget(BLANKS[1]!, 'x', undefined, noop, noop)
    expect(widget('x').eq(other)).toBe(false)
  })

  it('implements updateDOM and repairs the element in place', () => {
    const view = new EditorView()
    const dom = widget('').toDOM(view)
    const input = dom.querySelector<HTMLInputElement>('.cm-blank-input')!

    expect(widget('restored', 'correct').updateDOM(dom)).toBe(true)
    expect(input.value).toBe('restored')
    expect(input.dataset['state']).toBe('correct')
    view.destroy()
  })

  it('updateDOM never writes the value of a focused input', () => {
    const view = new EditorView()
    const dom = widget('').toDOM(view)
    document.body.appendChild(dom)
    const input = dom.querySelector<HTMLInputElement>('.cm-blank-input')!
    input.focus()
    input.value = 'typed'

    expect(widget('stale').updateDOM(dom)).toBe(true)
    expect(input.value).toBe('typed')
    view.destroy()
  })

  it('updateDOM refuses DOM that belongs to a different blank', () => {
    const view = new EditorView()
    const dom = widget('').toDOM(view)
    const other = new BlankWidget(BLANKS[1]!, 'x', undefined, noop, noop)

    expect(other.updateDOM(dom)).toBe(false)
    view.destroy()
  })
})
