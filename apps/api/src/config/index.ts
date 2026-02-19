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

const KNOWN_DEFAULT_SECRETS = ['development-secret-change-me']

export const config = {
  database: {
    url: resolveSecret('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/blankcode'),
  },
  jwt: {
    secret: resolveSecret('JWT_SECRET', 'development-secret-change-me'),
    expiresIn: process.env['JWT_EXPIRES_IN'] ?? '7d',
  },
  api: {
    port: Number.parseInt(process.env['API_PORT'] ?? '3000', 10),
    host: process.env['API_HOST'] ?? '0.0.0.0',
    corsOrigin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
  },
  execution: {
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
      vue: process.env['DOCKER_IMAGE_VUE'] ?? 'blankcode/runner-typescript:latest',
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

if (process.env['NODE_ENV'] === 'production' && KNOWN_DEFAULT_SECRETS.includes(config.jwt.secret)) {
  throw new Error(
    'JWT_SECRET must be set to a secure value in production. The default secret is not allowed.'
  )
}

if (process.env['NODE_ENV'] !== 'production' && KNOWN_DEFAULT_SECRETS.includes(config.jwt.secret)) {
}

if (config.admin.emails.length === 0) {
}
