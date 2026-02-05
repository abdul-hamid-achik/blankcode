import * as schema from '@blankcode/db/schema'
import { and, eq, lt } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { config } from '../config/index.js'
import { createSubmissionWorker } from './submission.worker.js'

const sql = postgres(config.database.url)
const db = drizzle(sql, { schema })

async function recoverStaleSubmissions() {
  const staleTimeout = new Date(Date.now() - 5 * 60 * 1000)
  const stale = await db
    .update(schema.submissions)
    .set({
      status: 'error',
      errorMessage: 'Worker recovery: submission was stuck in running state',
    })
    .where(
      and(eq(schema.submissions.status, 'running'), lt(schema.submissions.createdAt, staleTimeout))
    )
    .returning()
  if (stale.length > 0) {
    console.log(`[Worker] Recovered ${stale.length} stale submissions`)
  }
}

console.log('[Worker] Starting submission worker...')

const worker = createSubmissionWorker()

recoverStaleSubmissions().catch((err) => {
  console.error('[Worker] Failed to recover stale submissions:', err)
})

process.on('SIGTERM', async () => {
  console.log('[Worker] Received SIGTERM, shutting down...')
  await worker.close()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('[Worker] Received SIGINT, shutting down...')
  await worker.close()
  process.exit(0)
})

console.log('[Worker] Submission worker started')
