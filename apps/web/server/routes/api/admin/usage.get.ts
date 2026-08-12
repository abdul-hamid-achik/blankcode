import { createDatabaseFromEnv } from '@blankcode/db/client'
import { sql } from 'drizzle-orm'
import { requireAdmin } from '~/server/utils/admin'

/**
 * How the site is actually being used.
 *
 * Aggregates only. The question an operator has is "is this working" — which
 * exercises defeat everyone, whether people come back, how many hit the free
 * limit — and none of it needs a name attached. Listing individuals would make
 * this a surveillance page rather than a dashboard, and it would need saying so
 * in the privacy policy.
 *
 * The one exception is counts of *distinct* users, which is a number, not a
 * person.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = createDatabaseFromEnv()

  const totalsResult = await db.execute<{
    users: number
    paid: number
    submissions: number
    submissions_7d: number
    passed_7d: number
  }>(sql`
    select
      (select count(*)::int from users) as users,
      (select count(*)::int from users
        where subscription_status in ('active', 'trialing', 'past_due')) as paid,
      (select count(*)::int from submissions) as submissions,
      (select count(*)::int from submissions
        where created_at > now() - interval '7 days') as submissions_7d,
      (select count(*)::int from submissions
        where created_at > now() - interval '7 days' and status = 'passed') as passed_7d
  `)

  // Per-day, so a chart is possible and a quiet week is visible.
  const daily = await db.execute<{ day: string; submissions: number; people: number }>(sql`
    select
      to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
      count(*)::int as submissions,
      count(distinct user_id)::int as people
    from submissions
    where created_at > now() - interval '30 days'
    group by 1 order by 1
  `)

  /*
   * The exercises people cannot pass.
   *
   * This is the reason the page exists. An exercise everyone fails is usually
   * not hard — it is unclear, or its tests are wrong, and there is no other
   * signal that says so. Eleven of ours were literally impossible and nobody
   * found out by reading them.
   */
  const hardest = await db.execute<{
    slug: string
    title: string
    attempts: number
    pass_rate: number
  }>(sql`
    select e.slug, e.title,
      count(*)::int as attempts,
      round(100.0 * sum(case when s.status = 'passed' then 1 else 0 end) / count(*))::int as pass_rate
    from submissions s
    join exercises e on e.id = s.exercise_id
    group by e.slug, e.title
    having count(*) >= 3
    order by pass_rate asc, attempts desc
    limit 10
  `)

  // What the free-tier limit should be, once there is data behind it.
  const aiResult = await db.execute<{ explanations_7d: number; people: number }>(sql`
    select
      count(*)::int as explanations_7d,
      count(distinct user_id)::int as people
    from usage_events
    where kind = 'ai_explain' and created_at > now() - interval '7 days'
  `)

  /*
   * The agent funnel, server-side. The `agent-connected` client event goes
   * to Vercel Analytics, but the operator question — is agent practice being
   * used, and is the reflect loop closing — is answerable from rows we
   * already keep: sessions, agent submissions, reflections, standing holds.
   */
  const agentResult = await db.execute<{
    people_7d: number
    sessions_7d: number
    submissions_7d: number
    reflections_7d: number
    unexplained_now: number
  }>(sql`
    select
      (select count(distinct user_id)::int from harness_sessions
        where last_seen_at > now() - interval '7 days') as people_7d,
      (select count(*)::int from harness_sessions
        where last_seen_at > now() - interval '7 days') as sessions_7d,
      (select count(*)::int from submissions
        where via = 'agent' and created_at > now() - interval '7 days') as submissions_7d,
      (select count(*)::int from reflections
        where created_at > now() - interval '7 days') as reflections_7d,
      (select count(*)::int from review_schedules
        where held_next_review_at is not null) as unexplained_now
  `)

  // `db.execute` returns a QueryResult, not an array — destructuring it looks
  // right and yields undefined.
  return {
    totals: totalsResult.rows[0] ?? null,
    daily: daily.rows,
    hardest: hardest.rows,
    ai: aiResult.rows[0] ?? null,
    agent: agentResult.rows[0] ?? null,
  }
})
