#!/usr/bin/env node
import 'dotenv-mono/load'
import { Sandbox } from '@vercel/sandbox'
import { SANDBOX_IMAGES, type SandboxImage, snapshotEnvVar } from './images.js'

/**
 * Builds one Vercel Sandbox snapshot per language and prints the env vars the
 * API needs. The serverless equivalent of `bun run runners:build`.
 *
 * Usage:
 *   bun run sandbox:build              # every language
 *   bun run sandbox:build go rust      # only these
 */

const requested = process.argv.slice(2).filter((a) => !a.startsWith('-'))

const images = requested.length
  ? SANDBOX_IMAGES.filter((i) => requested.includes(i.language))
  : SANDBOX_IMAGES

if (images.length === 0) {
  console.error(
    `No matching languages. Available: ${SANDBOX_IMAGES.map((i) => i.language).join(', ')}`
  )
  process.exit(1)
}

function checkAuth() {
  const hasOidc = Boolean(process.env['VERCEL_OIDC_TOKEN'])
  const hasToken =
    Boolean(process.env['VERCEL_TOKEN']) &&
    Boolean(process.env['VERCEL_TEAM_ID']) &&
    Boolean(process.env['VERCEL_PROJECT_ID'])

  if (!hasOidc && !hasToken) {
    console.error(
      [
        'No Vercel credentials found.',
        '',
        'Either link the project and pull a development token:',
        '  vercel link && vercel env pull .env.local',
        '',
        'or set VERCEL_TOKEN, VERCEL_TEAM_ID and VERCEL_PROJECT_ID.',
      ].join('\n')
    )
    process.exit(1)
  }
}

async function build(image: SandboxImage): Promise<{ language: string; snapshotId: string }> {
  const started = Date.now()
  console.log(`\n── ${image.language} (${image.runtime})`)

  const sandbox = await Sandbox.create({ runtime: image.runtime, timeout: 900_000 })

  try {
    for (const step of image.setup) {
      const stepStarted = Date.now()
      const result = await sandbox.runCommand(step.cmd, step.args)
      const seconds = ((Date.now() - stepStarted) / 1000).toFixed(1)

      if (result.exitCode !== 0) {
        const stderr = await result.stderr()
        throw new Error(
          `setup failed (${step.cmd} ${step.args[0] ?? ''}) exit=${result.exitCode}\n${stderr.slice(-800)}`
        )
      }
      console.log(`   setup ${step.cmd} ${step.args[0] ?? ''} — ${seconds}s`)
    }

    if (image.warmup) {
      const warmStarted = Date.now()
      await sandbox.writeFiles(
        Object.entries(image.warmup.files).map(([path, content]) => ({
          path,
          content: Buffer.from(content),
        }))
      )
      const result = await sandbox.runCommand(image.warmup.command.cmd, image.warmup.command.args)
      const seconds = ((Date.now() - warmStarted) / 1000).toFixed(1)
      if (result.exitCode !== 0) {
        console.log(`   ⚠ warmup exit=${result.exitCode} — snapshot will still work, just colder`)
      } else {
        console.log(`   warm build cache — ${seconds}s`)
      }

      /*
       * Remove the warmup sources before snapshotting. They live in the same
       * working directory a submission is written to, and Go refused to build
       * with "found packages main (solution.go) and warmup (warmup.go)". The
       * build *caches* survive outside this directory, which is the part worth
       * keeping.
       */
      const cleanup = Object.keys(image.warmup.files)
        .map((f) => `rm -rf ${JSON.stringify(f)}`)
        .join(' && ')
      await sandbox.runCommand('sh', ['-c', cleanup])
    }

    const snapshot = await sandbox.snapshot()
    console.log(
      `   ✓ ${snapshot.snapshotId}  (${((Date.now() - started) / 1000).toFixed(1)}s total)`
    )
    return { language: image.language, snapshotId: snapshot.snapshotId }
  } finally {
    await sandbox.stop()
  }
}

async function main() {
  checkAuth()
  console.log(`Building ${images.length} sandbox snapshot(s)…`)

  const built: Array<{ language: string; snapshotId: string }> = []
  const failed: Array<{ language: string; error: string }> = []

  for (const image of images) {
    try {
      built.push(await build(image))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`   ✗ ${image.language}: ${message}`)
      failed.push({ language: image.language, error: message })
    }
  }

  if (built.length > 0) {
    console.log('\nAdd these to your environment (Vercel project settings, or .env):\n')
    for (const { language, snapshotId } of built) {
      console.log(`${snapshotEnvVar(language)}=${snapshotId}`)
    }
    console.log('\nEXECUTION_BACKEND=vercel-sandbox')
  }

  if (failed.length > 0) {
    console.error(`\n${failed.length} image(s) failed: ${failed.map((f) => f.language).join(', ')}`)
    process.exit(1)
  }
}

await main()
