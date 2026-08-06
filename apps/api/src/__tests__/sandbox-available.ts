import { spawnSync } from 'node:child_process'

/**
 * Whether a sandbox-backed test can actually run here.
 *
 * These tests need Docker plus a built runner image, so they cannot simply run
 * everywhere. They used to be gated behind an env var (`RUST_EXECUTOR_DOCKER=1`),
 * which meant `bun run verify` never exercised them and nobody remembered to
 * set it — the suite passed 30/30 when someone finally did, but it could have
 * rotted for months without anyone noticing.
 *
 * Detecting the image instead means they run automatically for anyone who has
 * done `bun run runners:build`, and skip with a clear reason for anyone who
 * has not. The env var is kept as an override so CI can *demand* they run
 * rather than silently skipping.
 */
export function runnerImageAvailable(image: string): boolean {
  const forced = process.env['REQUIRE_SANDBOX_TESTS'] === '1'

  const result = spawnSync('docker', ['image', 'inspect', image], {
    stdio: 'ignore',
    timeout: 15_000,
  })
  const available = result.status === 0

  if (forced && !available) {
    throw new Error(
      `REQUIRE_SANDBOX_TESTS=1 but the image "${image}" is missing. Run \`bun run runners:build\`.`
    )
  }

  return available
}
