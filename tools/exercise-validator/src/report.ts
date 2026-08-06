import {
  countByRule,
  countBySeverity,
  type Finding,
  SEVERITIES,
  type Severity,
  sortFindings,
} from './finding.js'

const LABEL: Record<Severity, string> = {
  fatal: 'FATAL',
  error: 'ERROR',
  warning: 'WARNING',
}

const BLURB: Record<Severity, string> = {
  fatal: 'the importer skips the file or stores a broken exercise',
  error: 'imports, but violates a documented authoring rule',
  warning: 'needs a human judgement call',
}

export interface ReportOptions {
  readonly fileCount: number
  /** Emit ANSI colour. */
  readonly color: boolean
}

const COLORS: Record<Severity, string> = {
  fatal: '\u001b[31m',
  error: '\u001b[33m',
  warning: '\u001b[36m',
}
const DIM = '\u001b[2m'
const RESET = '\u001b[0m'

export function formatReport(findings: readonly Finding[], options: ReportOptions): string {
  const paint = (text: string, code: string) => (options.color ? `${code}${text}${RESET}` : text)
  const lines: string[] = []
  const sorted = sortFindings(findings)
  const counts = countBySeverity(findings)

  for (const severity of SEVERITIES) {
    const group = sorted.filter((finding) => finding.severity === severity)
    if (group.length === 0) continue

    lines.push('')
    lines.push(
      `${paint(LABEL[severity], COLORS[severity])} ${paint(`— ${group.length} finding${group.length === 1 ? '' : 's'} (${BLURB[severity]})`, DIM)}`
    )

    let currentFile = ''
    for (const finding of group) {
      if (finding.file !== currentFile) {
        currentFile = finding.file
        lines.push(`  ${currentFile}`)
      }
      lines.push(`    ${paint(`${finding.line}:${finding.column}`, DIM)}  ${finding.rule}`)
      lines.push(`      ${finding.message}`)
    }
  }

  const byRule = [...countByRule(findings)].toSorted(
    (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)
  )
  if (byRule.length > 0) {
    lines.push('')
    lines.push('Findings by rule')
    const width = Math.max(...byRule.map(([rule]) => rule.length))
    for (const [rule, count] of byRule) {
      lines.push(`  ${rule.padEnd(width)}  ${String(count).padStart(4)}`)
    }
  }

  lines.push('')
  lines.push(
    `${options.fileCount} file${options.fileCount === 1 ? '' : 's'} checked · ` +
      `${paint(`${counts.fatal} fatal`, COLORS.fatal)} · ` +
      `${paint(`${counts.error} error`, COLORS.error)} · ` +
      `${paint(`${counts.warning} warning`, COLORS.warning)}`
  )

  const dirty = new Set(findings.map((finding) => finding.file)).size
  lines.push(`${dirty} of ${options.fileCount} files have at least one finding`)

  return lines.join('\n')
}

export function formatJson(findings: readonly Finding[], fileCount: number): string {
  return JSON.stringify(
    {
      fileCount,
      counts: countBySeverity(findings),
      byRule: Object.fromEntries(countByRule(findings)),
      findings: sortFindings(findings),
    },
    null,
    2
  )
}
