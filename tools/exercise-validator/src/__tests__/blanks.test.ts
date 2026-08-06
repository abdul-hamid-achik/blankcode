import { describe, expect, it } from 'vitest'
import {
  BLANK_END_MARKER,
  BLANK_START_MARKER,
  checkTokenBalance,
  firstDivergentLine,
  renderStarterWithAnswers,
  scanRawBlanks,
} from '../blanks.js'

const S = BLANK_START_MARKER
const E = BLANK_END_MARKER

describe('scanRawBlanks', () => {
  it('returns the untrimmed span alongside the trimmed answer', () => {
    const scan = scanRawBlanks(`const x = ${S} 42 ${E};`)
    expect(scan.unclosedAt).toBeNull()
    expect(scan.blanks).toHaveLength(1)
    expect(scan.blanks[0]?.raw).toBe(' 42 ')
    expect(scan.blanks[0]?.answer).toBe('42')
  })

  it('numbers blanks in source order and records their offsets', () => {
    const code = `a = ${S}1${E}\nb = ${S}2${E}`
    const scan = scanRawBlanks(code)
    expect(scan.blanks.map((blank) => blank.answer)).toEqual(['1', '2'])
    expect(scan.blanks.map((blank) => blank.ordinal)).toEqual([0, 1])
    expect(code.slice(scan.blanks[1]?.startOffset ?? 0)).toBe(`${S}2${E}`)
  })

  it('reports the offset of a start marker with no end marker', () => {
    const scan = scanRawBlanks(`x = ${S}oops`)
    expect(scan.unclosedAt).toBe(4)
    expect(scan.blanks).toHaveLength(0)
  })

  it('keeps a multi-line span intact so the newline rule can see it', () => {
    const scan = scanRawBlanks(`f(${S}() => {\n  return 1\n}${E})`)
    expect(scan.blanks[0]?.raw).toContain('\n')
  })
})

describe('checkTokenBalance', () => {
  it.each([
    ['a + b', ''],
    ['map[string]int', 'go'],
    ['fmt.Errorf("boom: %w", err)', 'go'],
    ['f"{self.name} says {sound}!"', 'python'],
    ["typeof value === 'string'", 'typescript'],
    ["emit('update:modelValue', target.value)", 'typescript'],
    ["'validate', isValid, isValid ? undefined : 'Field is required'", 'typescript'],
    ["&'a str", 'rust'],
    ["Vec<&'static str>", 'rust'],
    ["'x'", 'rust'],
    ['"escaped \\" quote"', 'typescript'],
  ])('accepts %s', (answer, lang) => {
    expect(checkTokenBalance(answer, lang).balanced).toBe(true)
  })

  it.each([
    ['React.memo(', 'typescript'],
    [')', 'typescript'],
    ['defineEmits<{', 'typescript'],
    ['}>()', 'typescript'],
    ['watch(query', 'typescript'],
    ['withDefaults(defineProps<Props>()', 'typescript'],
    ['print("unterminated', 'python'],
  ])('rejects %s', (answer, lang) => {
    const result = checkTokenBalance(answer, lang)
    expect(result.balanced).toBe(false)
    expect(result.reason).toBeTruthy()
  })

  it('only treats a bare quote as a lifetime on the rust track', () => {
    // Without the language gate, `'update` reads as a lifetime and the closing
    // quote then looks unterminated.
    expect(checkTokenBalance("emit('update:x')", 'rust').balanced).toBe(false)
    expect(checkTokenBalance("emit('update:x')", 'typescript').balanced).toBe(true)
  })
})

describe('renderStarterWithAnswers', () => {
  it('substitutes every span in offset order', () => {
    const starter = 'let a = ___; let b = ______;'
    const rebuilt = renderStarterWithAnswers(starter, [
      { from: 8, to: 11, solution: '1' },
      { from: 21, to: 27, solution: 'second' },
    ])
    expect(rebuilt).toBe('let a = 1; let b = second;')
  })

  it('is an identity when there are no spans', () => {
    expect(renderStarterWithAnswers('untouched', [])).toBe('untouched')
  })
})

describe('firstDivergentLine', () => {
  it('returns null for identical text', () => {
    expect(firstDivergentLine('a\nb', 'a\nb')).toBeNull()
  })

  it('returns the 1-based line of the first difference', () => {
    expect(firstDivergentLine('a\nb\nc', 'a\nB\nc')).toBe(2)
  })
})
