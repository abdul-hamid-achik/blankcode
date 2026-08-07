import { Sandbox } from '@vercel/sandbox'

/**
 * Keeps the execution snapshots alive.
 *
 * A Vercel Sandbox snapshot expires after 30 days without use. When one
 * expires, every submission in that language fails — and it fails quietly, in
 * the sense that nothing about the deployment changed and no build broke. The
 * product simply stops working for a track until someone notices and rebuilds.
 *
 * Booting a sandbox from a snapshot counts as using it, so this creates one
 * per language and stops it immediately. Weekly is four times more often than
 * needed, which is the right margin for something whose failure mode is "the
 * whole product silently breaks".
 *
 * Deliberately does not rebuild anything. A rebuild is minutes of work, needs
 * the toolchains, and would change the snapshot IDs that live in the project's
 * environment variables — this only has to keep the clock from running out.
 */

const LANGUAGES = ['typescript', 'react', 'vue', 'python', 'go', 'rust'] as const

interface Result {
  language: string
  ok: boolean
  detail: string
}

export default defineEventHandler(async (event) => {
  // Vercel signs cron invocations with CRON_SECRET. Without the check, anyone
  // could spin up six microVMs per request.
  const secret = process.env['CRON_SECRET']
  if (secret) {
    const auth = getHeader(event, 'authorization')
    if (auth !== `Bearer ${secret}`) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }
  }

  const results: Result[] = []

  for (const language of LANGUAGES) {
    const snapshotId = process.env[`SANDBOX_SNAPSHOT_${language.toUpperCase()}`]
    if (!snapshotId) {
      results.push({ language, ok: false, detail: 'no snapshot configured' })
      continue
    }

    try {
      const sandbox = await Sandbox.create({
        source: { type: 'snapshot', snapshotId },
        persistent: false,
        timeout: 60_000,
      })
      // Booting is the whole point; there is nothing to run.
      void sandbox.stop().catch(() => {})
      results.push({ language, ok: true, detail: 'warmed' })
    } catch (error) {
      // One dead snapshot must not stop the other five from being warmed.
      results.push({ language, ok: false, detail: String(error) })
    }
  }

  const failed = results.filter((r) => !r.ok)
  if (failed.length > 0) {
    console.error(
      '[cron] snapshots that could not be warmed — execution is broken for these:',
      failed.map((r) => `${r.language}: ${r.detail}`).join('; ')
    )
  }

  // Reports 500 when anything failed, so the cron shows up as failing in the
  // dashboard rather than succeeding with bad news in its body.
  setResponseStatus(event, failed.length > 0 ? 500 : 200)
  return { warmed: results.filter((r) => r.ok).length, total: LANGUAGES.length, results }
})
