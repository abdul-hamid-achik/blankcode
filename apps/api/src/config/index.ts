import { readFileSync } from 'node:fs'

/** Reads a Docker Swarm secret file if the _FILE env var is set, otherwise falls back to the direct env var. */
function resolveSecret(envVar: string, fallback: string): string {
  const filePath = process.env[`${envVar}_FILE`]
  if (filePath) {
    try {
      return readFileSync(filePath, 'utf-8').trim()
    } catch {
      // Fall through to direct env var
    }
  }
  return process.env[envVar] ?? fallback
}

const KNOWN_DEFAULT_SECRETS = new Set([
  'development-secret-change-me',
  'your-super-secret-jwt-key-change-in-production',
])

/**
 * Validated on first USE, not on import.
 *
 * The module-level throw looked stricter and was actually a build bug:
 * anything that transitively imported this module — including `nuxt build`
 * evaluating server chunks — died without JWT_SECRET in its environment,
 * even though building needs no secrets at all. The guarantee that matters
 * survives untouched: no token is ever signed or verified with a missing or
 * known-default secret, because the getter below is the only way to read it.
 */
function requireJwtSecret(): string {
  const jwtSecret = resolveSecret('JWT_SECRET', '')
  if (!jwtSecret || KNOWN_DEFAULT_SECRETS.has(jwtSecret)) {
    throw new Error(
      'JWT_SECRET is missing or set to a known default. Set a unique secret in .env before starting (see .env.example).'
    )
  }
  return jwtSecret
}

export const config = {
  database: {
    url: resolveSecret('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/blankcode'),
  },
  jwt: {
    get secret(): string {
      return requireJwtSecret()
    },
    expiresIn: process.env['JWT_EXPIRES_IN'] ?? '7d',
  },
  api: {
    port: Number.parseInt(process.env['API_PORT'] ?? '3000', 10),
    host: process.env['API_HOST'] ?? '0.0.0.0',
    corsOrigin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
  },
  execution: {
    /*
     * Where submissions run.
     *   'docker'         — local Docker daemon (development, self-hosting)
     *   'vercel-sandbox' — Firecracker microVM per run (serverless deploys)
     * Docker cannot run inside a Vercel Function, so anything deployed there
     * has to use the sandbox backend.
     */
    backend: (process.env['EXECUTION_BACKEND'] ?? 'docker') as 'docker' | 'vercel-sandbox',
    timeoutMs: Number.parseInt(process.env['EXECUTION_TIMEOUT_MS'] ?? '60000', 10),
    memoryLimitMb: Number.parseInt(process.env['EXECUTION_MEMORY_MB'] ?? '256', 10),
    cpuLimit: Number.parseFloat(process.env['EXECUTION_CPU_LIMIT'] ?? '0.5'),
    dockerEnabled: process.env['DOCKER_ENABLED'] !== 'false',
    images: {
      typescript: process.env['DOCKER_IMAGE_TS'] ?? 'blankcode/runner-typescript:latest',
      javascript: process.env['DOCKER_IMAGE_JS'] ?? 'blankcode/runner-typescript:latest',
      python: process.env['DOCKER_IMAGE_PYTHON'] ?? 'blankcode/runner-python:latest',
      go: process.env['DOCKER_IMAGE_GO'] ?? 'blankcode/runner-go:latest',
      rust: process.env['DOCKER_IMAGE_RUST'] ?? 'blankcode/runner-rust:latest',
      vue: process.env['DOCKER_IMAGE_VUE'] ?? 'blankcode/runner-vue:latest',
      react: process.env['DOCKER_IMAGE_REACT'] ?? 'blankcode/runner-react:latest',
      node: process.env['DOCKER_IMAGE_NODE'] ?? 'blankcode/runner-typescript:latest',
    } as Record<string, string>,
  },
  rateLimit: {
    ttl: Number.parseInt(process.env['RATE_LIMIT_TTL'] ?? '60000', 10),
    limit: Number.parseInt(process.env['RATE_LIMIT_MAX'] ?? '100', 10),
    authTtl: Number.parseInt(process.env['RATE_LIMIT_AUTH_TTL'] ?? '60000', 10),
    authLimit: Number.parseInt(process.env['RATE_LIMIT_AUTH_MAX'] ?? '5', 10),
    submissionTtl: Number.parseInt(process.env['RATE_LIMIT_SUBMISSION_TTL'] ?? '60000', 10),
    submissionLimit: Number.parseInt(process.env['RATE_LIMIT_SUBMISSION_MAX'] ?? '30', 10),
  },
  admin: {
    emails: (process.env['ADMIN_EMAILS'] ?? '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean),
  },
}
