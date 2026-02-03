import { createSubmissionWorker } from './submission.worker.js'

console.log('[Worker] Starting submission worker...')

const worker = createSubmissionWorker()

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
