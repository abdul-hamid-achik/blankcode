import { describe, expect, it } from 'vitest'
import { maskStringContents, segmentTests } from '../testcode.js'

/**
 * A test declaration inside a string literal is a fixture, not a test. An
 * exercise about linting test files is made of them, and counting them gave
 * eight findings on a file with nothing wrong with it — the kind of noise that
 * teaches people to ignore the tool.
 */
describe('fixtures inside string literals', () => {
  it('does not segment a test that only appears inside a template literal', () => {
    const code = [
      "const fixture = `it('inner', () => {\\n  run()\\n})`",
      '',
      "it('real', () => {",
      '  expect(findings(fixture)).toHaveLength(1)',
      '})',
    ].join('\n')

    const segments = segmentTests('typescript', code)
    expect(segments.map((s) => s.name)).toEqual(['real'])
  })

  it('ignores single- and double-quoted fixtures too', () => {
    const code = [
      `const a = "it('quoted', () => { run() })"`,
      `const b = 'test("other", () => { run() })'`,
      '',
      "it('real', () => {",
      '  expect(1).toBe(1)',
      '})',
    ].join('\n')

    expect(segmentTests('typescript', code).map((s) => s.name)).toEqual(['real'])
  })

  it('still reads the name of a genuine test', () => {
    // The name lives inside a literal, which the mask blanks — so it has to be
    // read back from the original source, not the masked copy.
    const segments = segmentTests('typescript', "it('a real name', () => {\n  run()\n})")
    expect(segments[0]?.name).toBe('a real name')
  })

  it('keeps offsets pointing at the real source', () => {
    const code = ["const s = 'padding'", "it('later', () => {", '  run()', '})'].join('\n')
    const segment = segmentTests('typescript', code)[0]
    expect(code.slice(segment?.offset ?? 0)).toMatch(/^it\('later'/)
  })

  it('preserves newlines so line numbers do not shift', () => {
    const masked = maskStringContents("const s = `a\nb`\nit('x', () => {})")
    expect(masked.split('\n')).toHaveLength(3)
    expect(masked).toHaveLength("const s = `a\nb`\nit('x', () => {})".length)
  })

  it('handles an escaped quote inside a literal', () => {
    const code = [
      "const s = 'it(\\'nested\\', () => {})'",
      "it('real', () => {",
      '  run()',
      '})',
    ].join('\n')
    expect(segmentTests('typescript', code).map((s) => s.name)).toEqual(['real'])
  })
})
