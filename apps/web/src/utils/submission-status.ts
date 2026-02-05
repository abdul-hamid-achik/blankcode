import type { SubmissionStatus } from '@blankcode/shared'

interface StatusConfig {
  label: string
  colorClass: string
  bgClass: string
}

const statusConfig: Record<SubmissionStatus, StatusConfig> = {
  pending: {
    label: 'Pending',
    colorClass: 'text-muted-foreground',
    bgClass: 'bg-muted-foreground/20 text-muted-foreground',
  },
  running: { label: 'Running', colorClass: 'text-info', bgClass: 'bg-info/20 text-info' },
  passed: { label: 'Passed', colorClass: 'text-success', bgClass: 'bg-success/20 text-success' },
  failed: {
    label: 'Failed',
    colorClass: 'text-destructive',
    bgClass: 'bg-destructive/20 text-destructive',
  },
  error: {
    label: 'Error',
    colorClass: 'text-destructive',
    bgClass: 'bg-destructive/20 text-destructive',
  },
}

export function getStatusLabel(status: SubmissionStatus): string {
  return statusConfig[status]?.label ?? status
}

export function getStatusClasses(status: SubmissionStatus): StatusConfig {
  return statusConfig[status] ?? statusConfig.error
}

export { statusConfig }
