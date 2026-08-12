import { createDatabaseFromEnv } from '@blankcode/db/client'
import { sql } from 'drizzle-orm'
import { reviewsDue } from '~/server/utils/email/messages'
import { sendEmail } from '~/server/utils/email/send'

/**
 * The motor of the whole product.
 *
 * Spaced repetition without a nudge depends on people remembering to come back
 * on their own — the exact failure the mechanism exists to remove. The message
 * has been written and tested since the Resend work; this is the part that was
 * missing: nothing sent it.
 *
 * Daily at 14:00 UTC, which is morning in the Americas and evening in Europe —
 * both times someone might actually act on it. One send per user per day at
 * most, enforced by `last_reminder_at` rather than by trusting the schedule:
 * a cron that misfires twice must not mail twice.
 */
export default defineEventHandler(async (event) => {
  const secret = process.env['CRON_SECRET']
  const header = getHeader(event, 'authorization')
  if (!secret || header !== `Bearer ${secret}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const db = createDatabaseFromEnv()

  /*
   * Everyone with something due, reminders on, and no reminder in 20 hours.
   *
   * 20 rather than 24 so the send time can drift a little without skipping a
   * whole day: a cron that ran at 14:00 yesterday and 13:58 today would
   * otherwise silently skip today.
   */
  const due = await db.execute<{ id: string; email: string; due_count: number }>(sql`
    select u.id, u.email, count(rs.id)::int as due_count
    from users u
    join review_schedules rs on rs.user_id = u.id
    where rs.next_review_at <= now()
      and u.review_reminders_enabled
      and (u.last_reminder_at is null or u.last_reminder_at < now() - interval '20 hours')
    group by u.id, u.email
  `)

  const site = (useRuntimeConfig().public['siteUrl'] as string).replace(/\/+$/, '')
  let sent = 0
  let failed = 0

  for (const row of due.rows) {
    const result = await sendEmail(row.email, reviewsDue(row.due_count, `${site}/review`))

    if (result.ok) {
      sent++
      // Stamped per user, after the send. Stamping before would mark people as
      // reminded by an attempt that failed.
      await db.execute(sql`update users set last_reminder_at = now() where id = ${row.id}`)
    } else {
      failed++
    }
  }

  // Numbers, not addresses: this log line ends up in a dashboard.
  return { eligible: due.rows.length, sent, failed }
})
