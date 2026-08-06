import { Sandbox } from '@vercel/sandbox'
import { logger } from './logger.js'
import type { ExecutionContext } from './types.js'

/**
 * Runs a submission in a Vercel Sandbox instead of a local Docker container.
 *
 * Deliberately mirrors `executeInDocker`'s signature so the four language
 * executors do not care which backend is in use — the only difference is where
 * the microVM comes from.
 *
 * Why this is a better sandbox than the Docker one it replaces: each run gets a
 * Firecracker microVM with its own kernel, rather than a container sharing the
 * host's. Container escapes are a real class of bug; a VM boundary is not.
 *
 * Measured on the corpus (snapshot + no persistence): ~3.3s for Go, ~4.7s for
 * Rust end to end, which is at least as fast as the Docker path it replaces.
 */

/** Per-language snapshot with the toolchain and warm build caches baked in. */
function snapshotFor(language: string): string | undefined {
  const key = `SANDBOX_SNAPSHOT_${language.toUpperCase()}`
  return process.env[key] || undefined
}

export class MissingSnapshotError extends Error {
  constructor(language: string) {
    super(
      `No sandbox snapshot configured for "${language}". Set SANDBOX_SNAPSHOT_${language.toUpperCase()} — build one with \`bun run sandbox:build\`.`
    )
    this.name = 'MissingSnapshotError'
  }
}

export async function executeInVercelSandbox(
  context: ExecutionContext,
  files: Record<string, string>,
  command: string[]
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const snapshotId = snapshotFor(context.language)
  if (!snapshotId) {
    throw new MissingSnapshotError(context.language)
  }

  const started = Date.now()

  const sandbox = await Sandbox.create({
    source: { type: 'snapshot', snapshotId },
    // A submission is throwaway. Persistence snapshots the filesystem on stop,
    // which cost 5-7s per run and storage for state nobody reads again.
    persistent: false,
    timeout: context.timeoutMs,
  })

  try {
    await sandbox.writeFiles(
      Object.entries(files).map(([path, content]) => ({
        path,
        content: Buffer.from(content),
      }))
    )

    const [cmd, ...args] = command
    if (!cmd) throw new Error('Empty command')

    const result = await sandbox.runCommand(cmd, args)
    const [stdout, stderr] = await Promise.all([result.stdout(), result.stderr()])

    logger.info('sandbox.run', {
      submissionId: context.submissionId,
      language: context.language,
      exitCode: result.exitCode,
      durationMs: Date.now() - started,
    })

    return { stdout, stderr, exitCode: result.exitCode }
  } finally {
    // Teardown is fire-and-forget: the verdict is already in hand, and awaiting
    // it added seconds to what the learner waits for.
    void sandbox.stop().catch((error: unknown) => {
      logger.warn('sandbox.stop failed', {
        submissionId: context.submissionId,
        error: String(error),
      })
    })
  }
}
