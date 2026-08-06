import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MissingSnapshotError } from '../services/execution/vercel-sandbox.js'

/**
 * The sandbox backend is exercised end to end by `verify-sandbox.ts`, which
 * needs real Vercel credentials. These cover the parts that must hold without
 * network access — chiefly that the backend switch is a single seam, so the
 * four language executors never learn where they run.
 */

const EXECUTION_DIR = join(process.cwd(), 'src/services/execution')

describe('sandbox backend selection', () => {
  it('routes through one seam, so executors stay backend-agnostic', () => {
    const sandbox = readFileSync(join(EXECUTION_DIR, 'sandbox.ts'), 'utf-8')

    // The switch lives in executeInDocker itself.
    expect(sandbox).toContain("config.execution.backend === 'vercel-sandbox'")
    expect(sandbox).toContain('executeInVercelSandbox')
  })

  it.each(['typescript', 'python', 'go', 'rust'])(
    '%s.executor.ts does not know which backend it runs on',
    (name) => {
      const source = readFileSync(join(EXECUTION_DIR, `executors/${name}.executor.ts`), 'utf-8')
      expect(source).not.toContain('vercel-sandbox')
      expect(source).not.toContain('@vercel/sandbox')
    }
  )
})

describe('MissingSnapshotError', () => {
  it('names the env var the operator has to set', () => {
    const error = new MissingSnapshotError('rust')
    expect(error.message).toContain('SANDBOX_SNAPSHOT_RUST')
  })

  it('points at the command that produces it', () => {
    expect(new MissingSnapshotError('go').message).toContain('sandbox:build')
  })
})

/**
 * Each snapshot must actually put its toolchain on PATH. The first build did
 * not: `node_modules` was moved to `/` but `/node_modules/.bin` was never
 * linked, so five of six tracks died with `vitest: command not found`.
 */
describe('snapshot definitions', () => {
  const images = readFileSync(
    join(process.cwd(), '../../tools/sandbox-images/src/images.ts'),
    'utf-8'
  )

  it('links node binaries onto PATH', () => {
    expect(images).toContain('/node_modules/.bin/* /usr/local/bin/')
  })

  it('links cargo onto PATH', () => {
    expect(images).toContain('.cargo/bin/')
    expect(images).toContain('/usr/local/bin/')
  })

  it('installs a C linker for rust', () => {
    // rustup alone leaves cargo unable to link: "linker `cc` not found".
    expect(images).toMatch(/gcc/)
  })

  it('covers every language the app can execute', () => {
    for (const language of ['typescript', 'react', 'vue', 'python', 'go', 'rust']) {
      expect(images, `no snapshot defined for ${language}`).toContain(`language: '${language}'`)
    }
  })
})
