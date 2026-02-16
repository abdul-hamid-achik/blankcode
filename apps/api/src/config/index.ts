const KNOWN_DEFAULT_SECRETS = ['development-secret-change-me']

export const config = {
  database: {
    url: process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/blankcode',
  },
  redis: {
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: Number.parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
  },
  jwt: {
    secret: process.env['JWT_SECRET'] ?? 'development-secret-change-me',
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
    // Pin Docker images to specific versions for reproducible builds.
    // Using :latest can cause unexpected breakage when images are updated.
    // Override via environment variables when upgrading to a new version.
    images: {
      typescript: process.env['DOCKER_IMAGE_TS'] ?? 'blankcode/runner-typescript:1.0',
      javascript: process.env['DOCKER_IMAGE_JS'] ?? 'blankcode/runner-typescript:1.0',
      python: process.env['DOCKER_IMAGE_PYTHON'] ?? 'blankcode/runner-python:1.0',
      go: process.env['DOCKER_IMAGE_GO'] ?? 'blankcode/runner-go:1.0',
      rust: process.env['DOCKER_IMAGE_RUST'] ?? 'blankcode/runner-rust:1.0',
      vue: process.env['DOCKER_IMAGE_VUE'] ?? 'blankcode/runner-typescript:1.0',
      react: process.env['DOCKER_IMAGE_REACT'] ?? 'blankcode/runner-react:1.0',
      node: process.env['DOCKER_IMAGE_NODE'] ?? 'blankcode/runner-typescript:1.0',
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

if (
  process.env['NODE_ENV'] === 'production' &&
  (!process.env['JWT_SECRET'] || KNOWN_DEFAULT_SECRETS.includes(config.jwt.secret))
) {
  throw new Error(
    'JWT_SECRET must be set to a secure value in production. The default secret is not allowed.'
  )
}

if (process.env['NODE_ENV'] !== 'production' && KNOWN_DEFAULT_SECRETS.includes(config.jwt.secret)) {
  console.warn('⚠️  Using default JWT secret. Set JWT_SECRET in environment.')
}

if (config.admin.emails.length === 0) {
  console.warn('⚠️  ADMIN_EMAILS is empty. No users will have admin access.')
}
