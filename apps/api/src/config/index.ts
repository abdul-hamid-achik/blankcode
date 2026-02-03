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
  },
}
