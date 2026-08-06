import { describe, expect, it } from 'vitest'
import { BLANK_END_MARKER, BLANK_START_MARKER } from '../blanks.js'
import { countBySeverity, type Finding } from '../finding.js'
import { formatJson, formatReport } from '../report.js'
import {
  type ExerciseSource,
  trackLanguage,
  validateCorpus,
  validateExerciseSource,
} from '../validate.js'

const S = BLANK_START_MARKER
const E = BLANK_END_MARKER
const F = '```'

interface FixtureOptions {
  readonly file?: string
  readonly frontmatter?: readonly string[]
  readonly prose?: string
  readonly lang?: string
  readonly solution?: string
  readonly tests?: string | null
  readonly testsLang?: string
  readonly testsPreamble?: string
}

const DEFAULT_FRONTMATTER = [
  'slug: go-basics-adder',
  'title: Adder',
  'description: Add two numbers together.',
  'difficulty: beginner',
]

const DEFAULT_SOLUTION = [
  'package main',
  '',
  'func Add(a, b int) int {',
  `\treturn ${S}a + b${E}`,
  '}',
].join('\n')

const DEFAULT_TESTS = [
  'package main',
  '',
  'import "testing"',
  '',
  'func TestAdd(t *testing.T) {',
  '\tif Add(1, 2) != 3 {',
  '\t\tt.Errorf("Add(1, 2) = %d, want 3", Add(1, 2))',
  '\t}',
  '}',
].join('\n')

function fixture(options: FixtureOptions = {}): ExerciseSource {
  const {
    file = 'content/tracks/go/basics/go-bas-001.md',
    frontmatter = DEFAULT_FRONTMATTER,
    prose = 'Fill in the blank.',
    lang = 'go',
    solution = DEFAULT_SOLUTION,
    tests = DEFAULT_TESTS,
    testsLang = 'go',
    testsPreamble = '',
  } = options

  const parts = ['---', ...frontmatter, '---', '', prose, '', `${F}${lang}`, solution, F]
  if (tests !== null) {
    parts.push('', '## Tests', '')
    if (testsPreamble) parts.push(testsPreamble, '')
    parts.push(`${F}${testsLang}`, tests, F)
  }
  return { file, text: `${parts.join('\n')}\n` }
}

function rules(findings: readonly Finding[]): string[] {
  return findings.map((finding) => finding.rule)
}

function find(findings: readonly Finding[], rule: string): Finding | undefined {
  return findings.find((finding) => finding.rule === rule)
}

describe('validateExerciseSource', () => {
  it('accepts a well-formed exercise', () => {
    expect(validateExerciseSource(fixture())).toEqual([])
  })

  it('flags a blank answer that starts or ends with an underscore as fatal', () => {
    const findings = validateExerciseSource(
      fixture({
        file: 'content/tracks/python/oop/py-obj-001.md',
        lang: 'python',
        solution: [
          'class Pet:',
          `    def ${S}__init__${E}(self, name):`,
          '        self.name = name',
        ].join('\n'),
        testsLang: 'python',
        tests: ['def test_pet():', '    assert Pet("a").name == "a"'].join('\n'),
      })
    )
    const finding = find(findings, 'blank-underscore-boundary')
    expect(finding?.severity).toBe('fatal')
    // The parser has already eaten one underscore by the time it reports.
    expect(finding?.message).toContain('__init_')
  })

  it('flags a blank containing a newline as fatal', () => {
    const findings = validateExerciseSource(
      fixture({
        solution: ['package main', '', `var f = ${S}func() int {\n\treturn 1\n}${E}`].join('\n'),
      })
    )
    const finding = find(findings, 'blank-newline')
    expect(finding?.severity).toBe('fatal')
  })

  it('flags whitespace padding inside the markers and the offset drift it causes', () => {
    const findings = validateExerciseSource(
      fixture({ solution: ['package main', '', `var x = ${S} 42 ${E}`].join('\n') })
    )
    expect(find(findings, 'blank-padding')?.severity).toBe('error')
    expect(find(findings, 'roundtrip-mismatch')?.severity).toBe('fatal')
  })

  it('flags a blank that splits a token pair', () => {
    const findings = validateExerciseSource(
      fixture({
        file: 'content/tracks/react/perf/re-per-001.md',
        lang: 'tsx',
        solution: [
          `const Row = ${S}React.memo(${E}function Row() {`,
          '  return null;',
          `}${S})${E};`,
        ].join('\n'),
        testsLang: 'tsx',
        tests: [
          "import { Row } from './solution';",
          "it('renders', () => { expect(Row).toBeTruthy() });",
        ].join('\n'),
      })
    )
    expect(rules(findings).filter((rule) => rule === 'blank-unbalanced')).toHaveLength(2)
  })

  it('warns when a usage heading precedes the first fenced block', () => {
    const findings = validateExerciseSource(
      fixture({
        prose: ['## Requirements', '', 'Write a thing.', '', '## Example Usage'].join('\n'),
      })
    )
    const finding = find(findings, 'starter-not-first')
    expect(finding?.severity).toBe('error')
    expect(finding?.message).toContain('FIRST fenced block')
  })

  it('reports an unquoted colon in a hint as a fatal, located on the hint line', () => {
    const source = fixture({
      frontmatter: [
        ...DEFAULT_FRONTMATTER,
        'hints:',
        '  - The next state follows the cycle: Green -> Red',
      ],
    })
    const finding = find(validateExerciseSource(source), 'frontmatter-invalid')
    expect(finding?.severity).toBe('fatal')
    expect(finding?.line).toBe(7)
    expect(finding?.message).toContain('must be quoted')
  })

  it('still checks the blanks of a file whose frontmatter is fatal', () => {
    const source = fixture({
      frontmatter: [...DEFAULT_FRONTMATTER, 'hints:', '  - A colon: breaks this'],
      solution: ['package main', '', `var x = ${S} 42 ${E}`].join('\n'),
    })
    const found = rules(validateExerciseSource(source))
    expect(found).toContain('frontmatter-invalid')
    expect(found).toContain('blank-padding')
  })

  it('reports a missing Tests section as fatal', () => {
    const finding = find(validateExerciseSource(fixture({ tests: null })), 'tests-missing')
    expect(finding?.severity).toBe('fatal')
  })

  it('reports prose between the Tests heading and its fence as fatal', () => {
    // The importer regex only tolerates whitespace between the two.
    const findings = validateExerciseSource(fixture({ testsPreamble: 'Run these:' }))
    expect(find(findings, 'tests-unparsable')?.severity).toBe('fatal')
  })

  it('reports an empty Tests block as fatal', () => {
    const findings = validateExerciseSource(fixture({ tests: '' }))
    expect(find(findings, 'tests-empty')?.severity).toBe('fatal')
  })

  it('warns about a test function with no assertion', () => {
    const findings = validateExerciseSource(
      fixture({
        tests: ['package main', '', 'func TestRuns(t *testing.T) {', '\tmain()', '}'].join('\n'),
      })
    )
    const finding = find(findings, 'tests-no-assertions')
    expect(finding?.severity).toBe('warning')
    expect(finding?.message).toContain('TestRuns')
  })

  it('accepts a Go compile-time interface assertion as an assertion', () => {
    const findings = validateExerciseSource(
      fixture({
        tests: [
          'package main',
          '',
          'func TestShape(t *testing.T) {',
          '\tvar _ Shape = Rectangle{}',
          '}',
        ].join('\n'),
      })
    )
    expect(rules(findings)).not.toContain('tests-no-assertions')
  })

  it('flags markers that leak outside the starter block', () => {
    const source = fixture()
    const leaked: ExerciseSource = {
      file: source.file,
      text: source.text.replace('Fill in the blank.', `Fill in ${S}this${E}.`),
    }
    expect(rules(validateExerciseSource(leaked))).toContain('marker-outside-starter')
  })

  it('reports a file with no frontmatter as fatal', () => {
    const finding = find(
      validateExerciseSource({ file: 'content/tracks/go/basics/a.md', text: '# Just prose\n' }),
      'frontmatter-missing'
    )
    expect(finding?.severity).toBe('fatal')
  })

  it('reports a file with no fenced code block as fatal', () => {
    const source = fixture()
    const stripped: ExerciseSource = {
      file: source.file,
      text: source.text.slice(0, source.text.indexOf(F)),
    }
    expect(find(validateExerciseSource(stripped), 'code-block-missing')?.severity).toBe('fatal')
  })

  it('reports an unclosed blank marker as fatal', () => {
    const findings = validateExerciseSource(
      fixture({ solution: ['package main', '', `var x = ${S}42`].join('\n') })
    )
    expect(find(findings, 'blank-unclosed')?.severity).toBe('fatal')
  })

  it('reports an empty blank', () => {
    const findings = validateExerciseSource(
      fixture({ solution: ['package main', '', `var x = ${S}${E}`].join('\n') })
    )
    expect(find(findings, 'blank-empty')?.severity).toBe('error')
  })

  it('flags a challenge that still contains blank markers', () => {
    const findings = validateExerciseSource(
      fixture({ frontmatter: [...DEFAULT_FRONTMATTER, 'type: challenge'] })
    )
    expect(find(findings, 'challenge-has-blanks')?.severity).toBe('error')
  })

  it('flags a blank exercise with no blanks', () => {
    const findings = validateExerciseSource(
      fixture({
        solution: ['package main', '', 'func Add(a, b int) int { return a + b }'].join('\n'),
      })
    )
    expect(find(findings, 'blank-none')?.severity).toBe('error')
  })

  it('warns when the fence language disagrees with the track', () => {
    const findings = validateExerciseSource(fixture({ lang: 'typescript' }))
    expect(find(findings, 'fence-lang-mismatch')?.message).toContain('go track')
  })

  it('warns about beginner difficulty inside an advanced concept', () => {
    const findings = validateExerciseSource(
      fixture({ file: 'content/tracks/go/advanced-patterns/go-adv-001.md' })
    )
    const finding = find(findings, 'difficulty-suspect')
    expect(finding?.severity).toBe('warning')
    expect(finding?.line).toBe(5)
  })

  it('does not warn about difficulty when it is set deliberately', () => {
    const findings = validateExerciseSource(
      fixture({
        file: 'content/tracks/go/advanced-patterns/go-adv-001.md',
        frontmatter: DEFAULT_FRONTMATTER.map((line) =>
          line === 'difficulty: beginner' ? 'difficulty: advanced' : line
        ),
      })
    )
    expect(rules(findings)).not.toContain('difficulty-suspect')
  })
})

describe('validateCorpus', () => {
  it('reports a duplicate slug as fatal on both files', () => {
    const a = fixture({ file: 'content/tracks/go/structs/go-str-001.md' })
    const b = fixture({ file: 'content/tracks/go/structs/go-str-002.md' })
    const { findings, fileCount } = validateCorpus([a, b])

    expect(fileCount).toBe(2)
    const duplicates = findings.filter((finding) => finding.rule === 'slug-duplicate')
    expect(duplicates).toHaveLength(2)
    expect(duplicates.every((finding) => finding.severity === 'fatal')).toBe(true)
    expect(duplicates[0]?.message).toContain('go-str-002.md')
    expect(duplicates[0]?.line).toBe(2)
  })

  it('does not report unique slugs', () => {
    const a = fixture({ file: 'content/tracks/go/structs/go-str-001.md' })
    const b = fixture({
      file: 'content/tracks/go/structs/go-str-002.md',
      frontmatter: DEFAULT_FRONTMATTER.map((line) =>
        line.startsWith('slug:') ? 'slug: go-basics-subtractor' : line
      ),
    })
    expect(rules(validateCorpus([a, b]).findings)).not.toContain('slug-duplicate')
  })
})

describe('trackLanguage', () => {
  it.each([
    ['content/tracks/go/basics/a.md', 'go'],
    ['content/tracks/react/hooks/a.md', 'typescript'],
    ['content/tracks/vue/pinia/a.md', 'typescript'],
    ['content/tracks/rust/traits/a.md', 'rust'],
    ['content/tracks/unknown/x/a.md', ''],
  ])('maps %s to %s', (file, expected) => {
    expect(trackLanguage(file)).toBe(expected)
  })
})

describe('formatReport', () => {
  it('groups by severity and prints file:line for every finding', () => {
    const findings = validateExerciseSource(
      fixture({ solution: ['package main', '', `var x = ${S} 42 ${E}`].join('\n') })
    )
    const report = formatReport(findings, { fileCount: 1, color: false })

    expect(report).toContain('FATAL')
    expect(report).toContain('ERROR')
    expect(report).toContain('content/tracks/go/basics/go-bas-001.md')
    expect(report).toMatch(/\d+:\d+ {2}blank-padding/)
    expect(report).toContain('1 file checked')
    expect(countBySeverity(findings).fatal).toBeGreaterThan(0)
  })

  it('emits machine-readable JSON with the same findings', () => {
    const findings = validateExerciseSource(fixture({ tests: null }))
    const payload = JSON.parse(formatJson(findings, 1)) as {
      fileCount: number
      counts: { fatal: number }
      byRule: Record<string, number>
      findings: Finding[]
    }
    expect(payload.fileCount).toBe(1)
    expect(payload.counts.fatal).toBe(1)
    expect(payload.byRule['tests-missing']).toBe(1)
    expect(payload.findings[0]?.file).toBe('content/tracks/go/basics/go-bas-001.md')
  })
})
