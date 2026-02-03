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
    timeoutMs: Number.parseInt(process.env['EXECUTION_TIMEOUT_MS'] ?? '30000', 10),
    memoryLimitMb: Number.parseInt(process.env['EXECUTION_MEMORY_MB'] ?? '256', 10),
    cpuLimit: Number.parseFloat(process.env['EXECUTION_CPU_LIMIT'] ?? '0.5'),
    dockerEnabled: process.env['DOCKER_ENABLED'] !== 'false',
    images: {
      typescript: process.env['DOCKER_IMAGE_TS'] ?? 'blankcode/runner-typescript:latest',
      javascript: process.env['DOCKER_IMAGE_JS'] ?? 'blankcode/runner-typescript:latest',
      python: process.env['DOCKER_IMAGE_PYTHON'] ?? 'blankcode/runner-python:latest',
      go: process.env['DOCKER_IMAGE_GO'] ?? 'blankcode/runner-go:latest',
      rust: process.env['DOCKER_IMAGE_RUST'] ?? 'blankcode/runner-rust:latest',
    },
  },
  rateLimit: {
    ttl: Number.parseInt(process.env['RATE_LIMIT_TTL'] ?? '60000', 10),
    limit: Number.parseInt(process.env['RATE_LIMIT_MAX'] ?? '100', 10),
    authTtl: Number.parseInt(process.env['RATE_LIMIT_AUTH_TTL'] ?? '60000', 10),
    authLimit: Number.parseInt(process.env['RATE_LIMIT_AUTH_MAX'] ?? '5', 10),
    submissionTtl: Number.parseInt(process.env['RATE_LIMIT_SUBMISSION_TTL'] ?? '60000', 10),
    submissionLimit: Number.parseInt(process.env['RATE_LIMIT_SUBMISSION_MAX'] ?? '30', 10),
  },
}
