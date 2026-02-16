import * as schema from '@blankcode/db/schema'
import { and, eq, lt } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { config } from '../config/index.js'
import { createSubmissionWorker } from './submission.worker.js'

const sql = postgres(config.database.url)
const db = drizzle(sql, { schema })

// Configurable interval for periodic stale job recovery (default: 2 minutes)
const STALE_CHECK_INTERVAL = Number.parseInt(
  process.env['STALE_CHECK_INTERVAL_MS'] ?? String(2 * 60 * 1000),
  10
)

async function recoverStaleSubmissions() {
  const staleTimeout = new Date(Date.now() - 5 * 60 * 1000)
  const stale = await db
    .update(schema.submissions)
    .set({
      status: 'error',
      errorMessage: 'Worker recovery: submission was stuck in running state',
      updatedAt: new Date(),
    })
    .where(
      and(eq(schema.submissions.status, 'running'), lt(schema.submissions.updatedAt, staleTimeout))
    )
    .returning()
  if (stale.length > 0) {
    console.log(`[Worker] Recovered ${stale.length} stale submissions`)
  }
}

console.log('[Worker] Starting submission worker...')

const worker = createSubmissionWorker(db)

// Run stale recovery once at startup, then periodically
recoverStaleSubmissions().catch((err) => {
  console.error('[Worker] Failed to recover stale submissions:', err)
})

const staleCheckTimer = setInterval(() => {
  recoverStaleSubmissions().catch((err) => {
    console.error('[Worker] Periodic stale recovery failed:', err)
  })
}, STALE_CHECK_INTERVAL)

async function gracefulShutdown(signal: string) {
  console.log(`[Worker] Received ${signal}, shutting down gracefully...`)
  clearInterval(staleCheckTimer)

  const shutdownTimeout = setTimeout(() => {
    console.error('[Worker] Graceful shutdown timed out after 30s, forcing exit')
    process.exit(1)
  }, 30_000)

  try {
    await worker.close()
  } finally {
    clearTimeout(shutdownTimeout)
    process.exit(0)
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

console.log('[Worker] Submission worker started')
