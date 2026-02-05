# BlankCode

A modern, interactive coding exercise platform for learning programming through hands-on practice. Built with Vue.js, NestJS, and a robust async execution system.

## Features

- **Multi-Language Support**: Practice coding in TypeScript, JavaScript, Python, Go, Rust, and Vue
- **Interactive Code Editor**: CodeMirror-powered editor with syntax highlighting, customizable font size, and tab settings
- **Real-Time Test Execution**: Async job processing with detailed test results and execution metrics
- **Progress Tracking**: Track mastery levels, completion rates, and learning streaks
- **Content Management**: Markdown-based exercises with automated parsing and blank region detection
- **Secure Execution**: Sandboxed code execution with resource limits and timeouts

## Quick Start

```bash
# Clone the repository
git clone https://github.com/abdul-hamid-achik/blankcode.git
cd blankcode

# Install dependencies
bun install

# Set up environment variables
cp .env.example .env

# Start database and Redis
docker compose up -d

# Run database migrations
bun run db:push

# Start development servers
bun run dev
```

The web application will be available at `http://localhost:5173` and the API at `http://localhost:3000`.

## Project Structure

```
blankcode/
├── apps/
│   ├── api/          # NestJS backend server
│   └── web/          # Vue 3 frontend application
├── packages/
│   ├── db/           # Drizzle ORM schema and migrations
│   ├── shared/       # Shared types, schemas, and utilities
│   └── exercise-parser/  # Markdown exercise parser
├── tools/
│   ├── content-importer/   # CLI for importing exercises
│   └── exercise-generator/ # CLI for generating exercises
├── content/          # Exercise content in markdown format
└── docker/           # Docker configurations
```

## Prerequisites

- [Bun](https://bun.sh/) >= 1.3.7
- [Node.js](https://nodejs.org/) >= 20 (for some tooling)
- [Docker](https://www.docker.com/) and Docker Compose
- PostgreSQL 17 (via Docker or local installation)
- Redis 7.4 (via Docker or local installation)

## Installation

### 1. Install Dependencies

```bash
bun install
```

### 2. Configure Environment

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/blankcode

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# API
API_PORT=3000
API_HOST=0.0.0.0
CORS_ORIGIN=http://localhost:5173

# JWT Authentication
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# Code Execution
EXECUTION_TIMEOUT=30000
EXECUTION_MEMORY_LIMIT=256
DOCKER_EXECUTION_ENABLED=false

# AI Generation (optional)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
```

### 3. Start Infrastructure

```bash
# Start PostgreSQL and Redis
docker compose up -d

# Run database migrations
bun run db:push
```

### 4. Import Content (Optional)

```bash
# Import exercise content from markdown files
bun run content:import
```

## Development

### Running the Development Server

```bash
# Start all services (API, Web, Worker)
bun run dev

# Or run specific services
bun run dev --filter=@blankcode/api
bun run dev --filter=@blankcode/web
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start all services in development mode |
| `bun run build` | Build all packages for production |
| `bun run test` | Run unit tests |
| `bun run test:e2e` | Run end-to-end tests |
| `bun run lint` | Check code for linting errors |
| `bun run lint:fix` | Fix auto-fixable linting errors |
| `bun run typecheck` | Run TypeScript type checking |
| `bun run db:push` | Push schema changes to database |
| `bun run db:studio` | Open Drizzle Studio for database management |
| `bun run content:import` | Import exercises from markdown files |
| `bun run content:generate` | Generate exercises using AI |

### Code Quality

This project uses:

- **Biome** for linting and formatting
- **TypeScript** for type safety
- **Vitest** for unit testing
- **Playwright** for E2E testing
- **Knip** for detecting unused code
- **Lefthook** for git hooks

```bash
# Run all checks
bun run lint && bun run typecheck && bun run test
```

## Architecture

### Backend (NestJS)

The API is built with NestJS using the Fastify adapter for high performance:

- **Auth Module**: JWT-based authentication with rate limiting
- **Tracks Module**: Learning tracks and concepts management
- **Exercises Module**: Exercise retrieval with progress tracking
- **Submissions Module**: Code submission and async execution
- **Progress Module**: User progress and mastery tracking

### Frontend (Vue 3)

The web application uses Vue 3 with the Composition API:

- **Pinia** for state management
- **Vue Router** for navigation
- **Radix Vue** for accessible UI components
- **TailwindCSS** for styling
- **CodeMirror** for the code editor

### Code Execution

Submissions are processed asynchronously using BullMQ:

1. User submits code via the API
2. Submission is queued in Redis
3. Worker processes the submission with language-specific executor
4. Tests are run and results are parsed
5. Results are stored and user progress is updated

## Docker Deployment

### Full Stack Deployment

```bash
# Build and start all services
docker compose --profile full up -d

# With code execution runners
docker compose --profile full --profile runners up -d

# Watch for changes and rebuild
docker compose --profile full watch
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| `web` | 80 | Nginx serving the Vue frontend |
| `api` | 3000 | NestJS API server |
| `worker` | - | BullMQ submission processor |
| `postgres` | 5432 | PostgreSQL database |
| `redis` | 6379 | Redis for job queues |

## API Reference

### Authentication

```bash
# Register a new user
POST /auth/register
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "securepassword"
}

# Login
POST /auth/login
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

### Exercises

```bash
# Get all exercises
GET /exercises

# Get exercise by ID
GET /exercises/:exerciseId

# Submit code
POST /submissions
{
  "exerciseId": "exercise-uuid",
  "code": "function solution() { return 42; }"
}
```

### Rate Limits

| Endpoint | Limit |
|----------|-------|
| General | 100 requests/minute |
| Auth | 5 requests/minute |
| Submissions | 30 requests/minute |

## Content Authoring

Exercises are written in Markdown with YAML frontmatter:

```markdown
---
slug: hello-world
title: Hello World
description: Write your first program
difficulty: beginner
hints:
  - Use console.log() to print output
  - Strings should be wrapped in quotes
tags:
  - basics
  - output
---

# Hello World

Write a function that returns the string "Hello, World!".

\`\`\`typescript
export function hello(): string {
  return ___blank_start___"Hello, World!"___blank_end___;
}
\`\`\`
```

Place exercise files in `content/tracks/{language}/{concept}/`.

## Testing

### Unit Tests

```bash
# Run all unit tests
bun run test

# Run tests for a specific package
bun run test --filter=@blankcode/api
bun run test --filter=@blankcode/web

# Run tests in watch mode
bun run test -- --watch
```

### E2E Tests

```bash
# Run Playwright tests
bun run test:e2e

# Run with UI
bun run test:e2e -- --ui
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `bun run test`
5. Commit your changes: `git commit -m 'feat: add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

See [AGENTS.md](./AGENTS.md) for guidelines on AI-assisted development.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [NestJS](https://nestjs.com/) - A progressive Node.js framework
- [Vue.js](https://vuejs.org/) - The Progressive JavaScript Framework
- [Drizzle ORM](https://orm.drizzle.team/) - TypeScript ORM
- [CodeMirror](https://codemirror.net/) - Versatile text editor
- [BullMQ](https://docs.bullmq.io/) - Premium Message Queue for Node.js
