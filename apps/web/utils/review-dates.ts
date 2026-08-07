/**
 * The scheduler computes a date and the product used to swallow it: "scheduled
 * forward" after a rating, "Nothing is due" on an empty queue — both true,
 * neither saying *when*. These helpers turn an ISO date into the phrase a
 * person plans around. Pure and clock-injected, because "tomorrow" is a claim
 * about two dates, not one.
 */

const DAY_MS = 24 * 60 * 60 * 1000

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Calendar days between two instants, in the viewer's local calendar. */
export function calendarDaysUntil(iso: string, now: Date = new Date()): number {
  const target = new Date(iso)
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return Math.round((startOfDay(target) - startOfDay(now)) / DAY_MS)
}

/**
 * "today" / "tomorrow" / "on Thursday" / "on Feb 12".
 *
 * Weekday names only within the coming week, where they identify one day;
 * further out they stop meaning anything and the date takes over.
 */
export function speakReturnDay(iso: string, now: Date = new Date()): string {
  const days = calendarDaysUntil(iso, now)
  const target = new Date(iso)

  if (days <= 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days < 7) return `on ${WEEKDAYS[target.getDay()]}`
  return `on ${MONTHS[target.getMonth()]} ${target.getDate()}`
}

/** The post-rating sentence: "comes back tomorrow" / "comes back on Feb 12". */
export function speakSchedule(nextReviewAt: string, now: Date = new Date()): string {
  return `comes back ${speakReturnDay(nextReviewAt, now)}`
}

/**
 * The empty-queue / dashboard sentence about the next batch:
 * "3 come back on Thursday", "1 comes back tomorrow".
 */
export function speakNextBatch(
  next: { date: string; count: number } | null,
  now: Date = new Date()
): string | null {
  if (!next) return null
  const verb = next.count === 1 ? 'comes back' : 'come back'
  return `${next.count} ${verb} ${speakReturnDay(`${next.date}T00:00:00`, now)}`
}
