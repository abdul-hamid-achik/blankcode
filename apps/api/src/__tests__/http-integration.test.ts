// DB tag
import { Drizzle } from '@blankcode/db/client'
import { HttpApiBuilder, HttpBody, HttpClient } from '@effect/platform'
import { NodeHttpServer } from '@effect/platform-node'
import { WorkflowEngine } from '@effect/workflow/WorkflowEngine'
import { Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
// Errors
import { ConflictError, NotFoundError, UnauthorizedError } from '../api/errors.js'
// API definition
import { BlankCodeApi } from '../api/index.js'
// Handlers
import { AuthHandlers } from '../handlers/auth.handlers.js'
import { ExercisesHandlers } from '../handlers/exercises.handlers.js'
import { GenerationHandlers } from '../handlers/generation.handlers.js'
import { HealthHandlers } from '../handlers/health.handlers.js'
import { ProgressHandlers } from '../handlers/progress.handlers.js'
import { SubmissionsHandlers } from '../handlers/submissions.handlers.js'
import { TracksHandlers } from '../handlers/tracks.handlers.js'
import { UsersHandlers } from '../handlers/users.handlers.js'
import { AdminAuthorizationLive } from '../middleware/admin.middleware.js'
// Middleware
import { AuthorizationLive } from '../middleware/auth.middleware.js'
import { AuthRateLimitLive, SubmissionRateLimitLive } from '../middleware/rate-limit.middleware.js'
import { AuthService } from '../modules/auth/auth.service.js'
import { ExercisesService } from '../modules/exercises/exercises.service.js'
import { GenerationServiceLive } from '../modules/generation/generation.service.js'
import { ProgressService } from '../modules/progress/progress.service.js'
import { SubmissionsService } from '../modules/submissions/submissions.service.js'
import { TracksService } from '../modules/tracks/tracks.service.js'
import { UsersService } from '../modules/users/users.service.js'
// Services
import { JwtService, JwtServiceLive } from '../services/jwt.service.js'

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_USER = {
  id: 'user-1',
  email: 'test@example.com',
  username: 'testuser',
  displayName: 'Test User',
  avatarUrl: null,
  passwordHash: '$2b$12$LJ3m4ymPnOqCGkCCfA1vau1K1IaKSLOv1w8G4aOJv6zLJzGgDMFHy', // bcrypt hash of 'password123'
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
}

const MOCK_TRACK = {
  id: 'track-1',
  slug: 'typescript',
  name: 'TypeScript',
  description: 'Learn TypeScript',
  iconUrl: null,
  order: 1,
  isPublished: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const MOCK_CONCEPT = {
  id: 'concept-1',
  trackId: 'track-1',
  slug: 'basics',
  name: 'Basics',
  description: 'TypeScript basics',
  order: 1,
  isPublished: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  track: MOCK_TRACK,
}

const MOCK_EXERCISE = {
  id: 'exercise-1',
  conceptId: 'concept-1',
  slug: 'hello-world',
  name: 'Hello World',
  description: 'Your first exercise',
  difficulty: 'beginner',
  starterCode: 'const x = ___',
  solutionCode: 'const x = 1',
  testCode: 'expect(x).toBe(1)',
  language: 'typescript',
  order: 1,
  isPublished: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  concept: MOCK_CONCEPT,
}

const MOCK_SUBMISSION = {
  id: 'submission-1',
  userId: 'user-1',
  exerciseId: 'exercise-1',
  code: 'const x = 1',
  status: 'pending',
  testResults: null,
  executionTimeMs: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  exercise: MOCK_EXERCISE,
}

// ---------------------------------------------------------------------------
// Mock services — these replace real DB-backed services
// ---------------------------------------------------------------------------

const MockAuthService = Layer.effect(
  AuthService,
  Effect.gen(function* () {
    const jwt = yield* JwtService
    return AuthService.of({
      register: (input) =>
        Effect.gen(function* () {
          if (input.email === 'existing@example.com') {
            return yield* Effect.fail(
              new ConflictError({ message: 'User with this email already exists' })
            )
          }
          const accessToken = yield* jwt.sign({ sub: 'new-user-id', email: input.email })
          return {
            user: {
              id: 'new-user-id',
              email: input.email,
              username: input.username,
              displayName: input.displayName ?? null,
            },
            accessToken,
            refreshToken: 'mock-refresh-token',
            refreshTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          }
        }),
      login: (input) =>
        Effect.gen(function* () {
          if (input.email !== 'test@example.com' || input.password !== 'password123') {
            return yield* Effect.fail(new UnauthorizedError({ message: 'Invalid credentials' }))
          }
          const accessToken = yield* jwt.sign({ sub: MOCK_USER.id, email: MOCK_USER.email })
          return {
            user: {
              id: MOCK_USER.id,
              email: MOCK_USER.email,
              username: MOCK_USER.username,
              displayName: MOCK_USER.displayName as string | null,
            },
            accessToken,
            refreshToken: 'mock-refresh-token',
            refreshTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          }
        }),
      validateUser: (userId) =>
        Effect.succeed(
          userId === MOCK_USER.id
            ? {
                id: MOCK_USER.id,
                email: MOCK_USER.email,
                username: MOCK_USER.username,
                displayName: MOCK_USER.displayName as string | null,
                avatarUrl: MOCK_USER.avatarUrl as string | null,
              }
            : null
        ),
      validateAndRotateRefreshToken: (token) =>
        Effect.gen(function* () {
          if (token !== 'valid-refresh-token') {
            return yield* Effect.fail(new UnauthorizedError({ message: 'Invalid refresh token' }))
          }
          const accessToken = yield* jwt.sign({ sub: MOCK_USER.id, email: MOCK_USER.email })
          return {
            user: {
              id: MOCK_USER.id,
              email: MOCK_USER.email,
              username: MOCK_USER.username,
              displayName: MOCK_USER.displayName as string | null,
            },
            accessToken,
            refreshToken: 'new-mock-refresh-token',
            refreshTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          }
        }),
      revokeRefreshToken: () => Effect.void,
    })
  })
)

const MockUsersService = Layer.succeed(UsersService, {
  findById: (id) => {
    if (id !== MOCK_USER.id) return Effect.fail(new NotFoundError({ resource: 'User', id }))
    return Effect.succeed({
      id: MOCK_USER.id,
      email: MOCK_USER.email,
      username: MOCK_USER.username,
      displayName: MOCK_USER.displayName,
      avatarUrl: MOCK_USER.avatarUrl,
      createdAt: MOCK_USER.createdAt,
    })
  },
  findByUsername: (username) => {
    if (username !== MOCK_USER.username)
      return Effect.fail(new NotFoundError({ resource: 'User', id: username }))
    return Effect.succeed({
      id: MOCK_USER.id,
      username: MOCK_USER.username,
      displayName: MOCK_USER.displayName,
      avatarUrl: MOCK_USER.avatarUrl,
      createdAt: MOCK_USER.createdAt,
    })
  },
  update: (id, input) => {
    if (id !== MOCK_USER.id) return Effect.fail(new NotFoundError({ resource: 'User', id }))
    return Effect.succeed({
      id: MOCK_USER.id,
      email: MOCK_USER.email,
      username: MOCK_USER.username,
      displayName: input.displayName ?? MOCK_USER.displayName,
      avatarUrl: input.avatarUrl ?? MOCK_USER.avatarUrl,
    })
  },
})

const MockTracksService = Layer.succeed(TracksService, {
  findAll: () => Effect.succeed([MOCK_TRACK]),
  findBySlug: (slug) => {
    if (slug !== 'typescript')
      return Effect.fail(new NotFoundError({ resource: 'Track', id: slug }))
    return Effect.succeed({ ...MOCK_TRACK, concepts: [MOCK_CONCEPT] })
  },
  findById: (id) => {
    if (id !== 'track-1') return Effect.fail(new NotFoundError({ resource: 'Track', id }))
    return Effect.succeed(MOCK_TRACK)
  },
})

const MockExercisesService = Layer.succeed(ExercisesService, {
  findAll: () => Effect.succeed([]),
  findByConceptSlug: (trackSlug, conceptSlug) => {
    if (trackSlug !== 'typescript' || conceptSlug !== 'basics') {
      return Effect.fail(new NotFoundError({ resource: 'Concept', id: conceptSlug }))
    }
    return Effect.succeed([MOCK_EXERCISE])
  },
  findBySlug: (trackSlug, conceptSlug, exerciseSlug) => {
    if (trackSlug !== 'typescript' || conceptSlug !== 'basics' || exerciseSlug !== 'hello-world') {
      return Effect.fail(new NotFoundError({ resource: 'Exercise', id: exerciseSlug }))
    }
    return Effect.succeed(MOCK_EXERCISE)
  },
  findById: (id) => {
    if (id !== 'exercise-1') return Effect.fail(new NotFoundError({ resource: 'Exercise', id }))
    return Effect.succeed(MOCK_EXERCISE)
  },
  findWithProgress: (exerciseId, _userId) => {
    if (exerciseId !== 'exercise-1')
      return Effect.fail(new NotFoundError({ resource: 'Exercise', id: exerciseId }))
    return Effect.succeed({
      exercise: MOCK_EXERCISE,
      code: MOCK_EXERCISE.starterCode,
      codeSource: 'starter' as const,
      draft: null,
      lastSubmission: null,
    })
  },
  saveDraft: (_userId, exerciseId, _code) => {
    if (exerciseId !== 'exercise-1')
      return Effect.fail(new NotFoundError({ resource: 'Exercise', id: exerciseId }))
    return Effect.succeed({ success: true as const })
  },
  deleteDraft: () => Effect.succeed({ success: true as const }),
})

const VALID_EXERCISE_IDS = new Set(['exercise-1', '00000000-0000-0000-0000-000000000001'])

const MockSubmissionsService = Layer.succeed(SubmissionsService, {
  create: (_userId, input) => {
    if (!VALID_EXERCISE_IDS.has(input.exerciseId))
      return Effect.fail(new NotFoundError({ resource: 'Exercise', id: input.exerciseId }))
    return Effect.succeed({ ...MOCK_SUBMISSION, exerciseId: input.exerciseId })
  },
  createAndExecute: (_userId, input) => {
    if (!VALID_EXERCISE_IDS.has(input.exerciseId))
      return Effect.fail(new NotFoundError({ resource: 'Exercise', id: input.exerciseId }))
    return Effect.succeed({ ...MOCK_SUBMISSION, exerciseId: input.exerciseId })
  },
  findById: (id, _userId) => {
    if (id !== 'submission-1') return Effect.fail(new NotFoundError({ resource: 'Submission', id }))
    return Effect.succeed(MOCK_SUBMISSION)
  },
  findByExercise: () => Effect.succeed([MOCK_SUBMISSION]),
  findByUser: () => Effect.succeed([MOCK_SUBMISSION]),
  retry: (id, _userId) => {
    if (id !== 'submission-1') return Effect.fail(new NotFoundError({ resource: 'Submission', id }))
    return Effect.succeed({ ...MOCK_SUBMISSION, status: 'pending' })
  },
  updateStatus: () => Effect.succeed(MOCK_SUBMISSION),
})

const MockProgressService = Layer.succeed(ProgressService, {
  getSummary: () =>
    Effect.succeed([
      {
        trackSlug: 'typescript',
        trackName: 'TypeScript',
        totalExercises: 10,
        completedExercises: 3,
        masteryLevel: 0.3,
      },
    ]),
  getStats: () =>
    Effect.succeed({
      totalExercisesCompleted: 3,
      currentStreak: 2,
      longestStreak: 5,
      totalSubmissions: 15,
      lastActivityDate: new Date().toISOString(),
    }),
  getExerciseProgress: (_userId, exerciseId) => {
    if (exerciseId !== 'exercise-1')
      return Effect.fail(new NotFoundError({ resource: 'ExerciseProgress', id: exerciseId }))
    return Effect.succeed({ userId: 'user-1', exerciseId, isCompleted: true, attempts: 3 })
  },
  getConceptMastery: (_userId, conceptId) => {
    if (conceptId !== 'concept-1')
      return Effect.fail(new NotFoundError({ resource: 'ConceptMastery', id: conceptId }))
    return Effect.succeed({
      conceptId,
      masteryLevel: 0.5,
      exercisesCompleted: 2,
      exercisesTotal: 4,
    })
  },
  getTrackProgress: () =>
    Effect.succeed([
      {
        conceptId: 'concept-1',
        conceptSlug: 'basics',
        conceptName: 'Basics',
        mastery: null,
        totalExercises: 5,
      },
    ]),
  getActivityTimeline: () =>
    Effect.succeed([
      { date: '2025-01-15', submissions: 3, exercisesCompleted: 1 },
      { date: '2025-01-16', submissions: 5, exercisesCompleted: 2 },
    ]),
  markExerciseCompleted: () => Effect.void,
  incrementAttempts: () => Effect.void,
  updateConceptMastery: () => Effect.void,
})

// Mock Drizzle — used by the auth and admin middleware to look up users by JWT sub
const mockDrizzleDb = {
  query: {
    users: {
      findFirst: (opts: any) => {
        // The auth middleware queries by user id from JWT
        // We need to return a user for valid tokens
        return Promise.resolve({
          id: MOCK_USER.id,
          email: MOCK_USER.email,
          username: MOCK_USER.username,
          displayName: MOCK_USER.displayName,
          avatarUrl: MOCK_USER.avatarUrl,
        })
      },
    },
  },
}

const MockDrizzle = Layer.succeed(Drizzle, mockDrizzleDb as any)

// Mock WorkflowEngine — provides a no-op engine so submission handlers
// can call SubmissionWorkflow.execute({ discard: true }) without error.
const MockWorkflowEngine = Layer.succeed(
  WorkflowEngine,
  WorkflowEngine.of({
    register: () => Effect.void as any,
    execute: () => Effect.succeed('mock-execution-id') as any,
    poll: () => Effect.succeed(undefined) as any,
    interrupt: () => Effect.void,
    resume: () => Effect.void,
    activityExecute: () => Effect.succeed(undefined) as any,
    deferredResult: () => Effect.succeed(undefined) as any,
    deferredDone: () => Effect.void as any,
    scheduleClock: () => Effect.void,
  })
)

// ---------------------------------------------------------------------------
// Compose the full API layer with mock services
// ---------------------------------------------------------------------------

const MockServicesLive = Layer.mergeAll(
  MockAuthService,
  MockUsersService,
  MockTracksService,
  MockExercisesService,
  MockSubmissionsService,
  MockProgressService,
  GenerationServiceLive,
  MockWorkflowEngine
)

const HandlersLive = Layer.mergeAll(
  AuthHandlers,
  UsersHandlers,
  TracksHandlers,
  ExercisesHandlers,
  SubmissionsHandlers,
  ProgressHandlers,
  GenerationHandlers,
  HealthHandlers
)

const MiddlewareLive = Layer.mergeAll(
  AuthorizationLive,
  AdminAuthorizationLive,
  AuthRateLimitLive,
  SubmissionRateLimitLive
)

// Build the API layer (same as main.ts but with mocks)
const TestApiLive = HttpApiBuilder.api(BlankCodeApi).pipe(
  Layer.provide(HandlersLive),
  Layer.provide(MockServicesLive),
  Layer.provide(MiddlewareLive),
  Layer.provide(JwtServiceLive),
  Layer.provide(MockDrizzle)
)

// Server layer: HttpApiBuilder.serve() needs HttpServer + DefaultServices + HttpApi.Api
// NodeHttpServer.layerTest provides HttpServer + HttpClient + Platform + NodeContext
const ServerLayer = HttpApiBuilder.serve().pipe(Layer.provide(TestApiLive))

// Merge the server layer with layerTest so that HttpClient is available in the test effect
const TestLive = Layer.mergeAll(ServerLayer, NodeHttpServer.layerTest).pipe(
  Layer.provide(NodeHttpServer.layerTest)
)

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

function runTest<A, R>(effect: Effect.Effect<A, unknown, R>) {
  return Effect.runPromise(
    effect.pipe(Effect.provide(TestLive)) as Effect.Effect<A, unknown, never>
  )
}

/** Helper to get a valid JWT for authenticated requests */
function getAuthToken(): Effect.Effect<string, any, HttpClient.HttpClient> {
  return Effect.gen(function* () {
    const response = yield* HttpClient.post('/auth/login', {
      body: HttpBody.unsafeJson({ email: 'test@example.com', password: 'password123' }),
    })
    const body = (yield* response.json) as any
    return body.accessToken as string
  })
}

// ===========================================================================
// TESTS
// ===========================================================================

describe('HTTP Integration Tests', () => {
  // -------------------------------------------------------------------------
  // Health
  // -------------------------------------------------------------------------

  describe('Health', () => {
    it('GET /health returns 200 with status ok', () =>
      runTest(
        Effect.gen(function* () {
          const response = yield* HttpClient.get('/health')
          expect(response.status).toBe(200)
          const body = (yield* response.json) as any
          expect(body.status).toBe('ok')
          expect(body.timestamp).toBeDefined()
        })
      ))
  })

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  describe('Auth', () => {
    it('POST /auth/register with valid payload returns 200 with tokens', () =>
      runTest(
        Effect.gen(function* () {
          const response = yield* HttpClient.post('/auth/register', {
            body: HttpBody.unsafeJson({
              email: 'new@example.com',
              username: 'newuser',
              password: 'securepass123',
            }),
          })
          expect(response.status).toBe(200)
          const body = (yield* response.json) as any
          expect(body.user.email).toBe('new@example.com')
          expect(body.user.username).toBe('newuser')
          expect(body.accessToken).toBeDefined()
          expect(body.refreshToken).toBe('mock-refresh-token')
        })
      ))

    it('POST /auth/register with duplicate email returns 409', () =>
      runTest(
        Effect.gen(function* () {
          const response = yield* HttpClient.post('/auth/register', {
            body: HttpBody.unsafeJson({
              email: 'existing@example.com',
              username: 'anotheruser',
              password: 'securepass123',
            }),
          })
          expect(response.status).toBe(409)
        })
      ))

    it('POST /auth/register with invalid email returns 400', () =>
      runTest(
        Effect.gen(function* () {
          const response = yield* HttpClient.post('/auth/register', {
            body: HttpBody.unsafeJson({
              email: 'not-an-email',
              username: 'newuser',
              password: 'securepass123',
            }),
          })
          expect(response.status).toBe(400)
        })
      ))

    it('POST /auth/register with short password returns 400', () =>
      runTest(
        Effect.gen(function* () {
          const response = yield* HttpClient.post('/auth/register', {
            body: HttpBody.unsafeJson({
              email: 'new2@example.com',
              username: 'newuser2',
              password: 'short',
            }),
          })
          expect(response.status).toBe(400)
        })
      ))

    it('POST /auth/login with valid credentials returns 200 with tokens', () =>
      runTest(
        Effect.gen(function* () {
          const response = yield* HttpClient.post('/auth/login', {
            body: HttpBody.unsafeJson({
              email: 'test@example.com',
              password: 'password123',
            }),
          })
          expect(response.status).toBe(200)
          const body = (yield* response.json) as any
          expect(body.user.id).toBe(MOCK_USER.id)
          expect(body.user.email).toBe(MOCK_USER.email)
          expect(body.accessToken).toBeDefined()
          expect(body.refreshToken).toBe('mock-refresh-token')
        })
      ))

    it('POST /auth/login with wrong password returns 401', () =>
      runTest(
        Effect.gen(function* () {
          const response = yield* HttpClient.post('/auth/login', {
            body: HttpBody.unsafeJson({
              email: 'test@example.com',
              password: 'wrongpassword',
            }),
          })
          expect(response.status).toBe(401)
        })
      ))

    it('POST /auth/refresh with valid token returns 200', () =>
      runTest(
        Effect.gen(function* () {
          const response = yield* HttpClient.post('/auth/refresh', {
            body: HttpBody.unsafeJson({
              refreshToken: 'valid-refresh-token',
            }),
          })
          expect(response.status).toBe(200)
          const body = (yield* response.json) as any
          expect(body.accessToken).toBeDefined()
          expect(body.refreshToken).toBe('new-mock-refresh-token')
        })
      ))

    it('POST /auth/refresh with invalid token returns 401', () =>
      runTest(
        Effect.gen(function* () {
          const response = yield* HttpClient.post('/auth/refresh', {
            body: HttpBody.unsafeJson({
              refreshToken: 'invalid-token',
            }),
          })
          expect(response.status).toBe(401)
        })
      ))

    it('POST /auth/logout returns 204', () =>
      runTest(
        Effect.gen(function* () {
          const response = yield* HttpClient.post('/auth/logout', {
            body: HttpBody.unsafeJson({
              refreshToken: 'some-token',
            }),
          })
          expect(response.status).toBe(204)
        })
      ))
  })

  // -------------------------------------------------------------------------
  // Tracks (public)
  // -------------------------------------------------------------------------

  describe('Tracks', () => {
    it('GET /tracks returns 200 with array of tracks', () =>
      runTest(
        Effect.gen(function* () {
          const response = yield* HttpClient.get('/tracks')
          expect(response.status).toBe(200)
          const body = (yield* response.json) as any[]
          expect(Array.isArray(body)).toBe(true)
          expect(body.length).toBe(1)
          expect(body[0].slug).toBe('typescript')
        })
      ))

    it('GET /tracks/:slug returns 200 with track data', () =>
      runTest(
        Effect.gen(function* () {
          const response = yield* HttpClient.get('/tracks/typescript')
          expect(response.status).toBe(200)
          const body = (yield* response.json) as any
          expect(body.slug).toBe('typescript')
          expect(body.concepts).toBeDefined()
          expect(body.concepts.length).toBe(1)
        })
      ))

    it('GET /tracks/:slug returns 404 for unknown slug', () =>
      runTest(
        Effect.gen(function* () {
          const response = yield* HttpClient.get('/tracks/nonexistent')
          expect(response.status).toBe(404)
        })
      ))
  })

  // -------------------------------------------------------------------------
  // Exercises (public)
  // -------------------------------------------------------------------------

  describe('Exercises', () => {
    it('GET /exercises/:id returns 200 with exercise data', () =>
      runTest(
        Effect.gen(function* () {
          const response = yield* HttpClient.get('/exercises/exercise-1')
          expect(response.status).toBe(200)
          const body = (yield* response.json) as any
          expect(body.id).toBe('exercise-1')
          expect(body.slug).toBe('hello-world')
        })
      ))

    it('GET /exercises/:id returns 404 for unknown exercise', () =>
      runTest(
        Effect.gen(function* () {
          const response = yield* HttpClient.get('/exercises/nonexistent')
          expect(response.status).toBe(404)
        })
      ))

    it('GET /tracks/:trackSlug/concepts/:conceptSlug/exercises returns 200', () =>
      runTest(
        Effect.gen(function* () {
          const response = yield* HttpClient.get('/tracks/typescript/concepts/basics/exercises')
          expect(response.status).toBe(200)
          const body = (yield* response.json) as any[]
          expect(Array.isArray(body)).toBe(true)
          expect(body.length).toBe(1)
        })
      ))

    it('GET /tracks/:trackSlug/concepts/:conceptSlug/exercises/:exerciseSlug returns 200', () =>
      runTest(
        Effect.gen(function* () {
          const response = yield* HttpClient.get(
            '/tracks/typescript/concepts/basics/exercises/hello-world'
          )
          expect(response.status).toBe(200)
          const body = (yield* response.json) as any
          expect(body.slug).toBe('hello-world')
        })
      ))
  })

  // -------------------------------------------------------------------------
  // Protected endpoints — Users (auth required)
  // -------------------------------------------------------------------------

  describe('Users (protected)', () => {
    it('GET /users/me without token returns 401', () =>
      runTest(
        Effect.gen(function* () {
          const response = yield* HttpClient.get('/users/me')
          expect(response.status).toBe(401)
        })
      ))

    it('GET /users/me with valid token returns 200', () =>
      runTest(
        Effect.gen(function* () {
          const token = yield* getAuthToken()
          const response = yield* HttpClient.get('/users/me', {
            headers: { authorization: `Bearer ${token}` },
          })
          expect(response.status).toBe(200)
          const body = (yield* response.json) as any
          expect(body.id).toBe(MOCK_USER.id)
          expect(body.email).toBe(MOCK_USER.email)
          expect(body.username).toBe(MOCK_USER.username)
        })
      ))

    it('GET /users/:username returns 200 for known user', () =>
      runTest(
        Effect.gen(function* () {
          const token = yield* getAuthToken()
          const response = yield* HttpClient.get('/users/testuser', {
            headers: { authorization: `Bearer ${token}` },
          })
          expect(response.status).toBe(200)
          const body = (yield* response.json) as any
          expect(body.username).toBe('testuser')
        })
      ))

    it('GET /users/:username returns 404 for unknown user', () =>
      runTest(
        Effect.gen(function* () {
          const token = yield* getAuthToken()
          const response = yield* HttpClient.get('/users/nonexistent', {
            headers: { authorization: `Bearer ${token}` },
          })
          expect(response.status).toBe(404)
        })
      ))

    it('PATCH /users/me updates user profile', () =>
      runTest(
        Effect.gen(function* () {
          const token = yield* getAuthToken()
          const response = yield* HttpClient.patch('/users/me', {
            headers: { authorization: `Bearer ${token}` },
            body: HttpBody.unsafeJson({ displayName: 'Updated Name' }),
          })
          expect(response.status).toBe(200)
          const body = (yield* response.json) as any
          expect(body.displayName).toBe('Updated Name')
        })
      ))
  })

  // -------------------------------------------------------------------------
  // Protected endpoints — Progress (auth required)
  // -------------------------------------------------------------------------

  describe('Progress (protected)', () => {
    it('GET /progress/summary without token returns 401', () =>
      runTest(
        Effect.gen(function* () {
          const response = yield* HttpClient.get('/progress/summary')
          expect(response.status).toBe(401)
        })
      ))

    it('GET /progress/summary with valid token returns 200', () =>
      runTest(
        Effect.gen(function* () {
          const token = yield* getAuthToken()
          const response = yield* HttpClient.get('/progress/summary', {
            headers: { authorization: `Bearer ${token}` },
          })
          expect(response.status).toBe(200)
          const body = (yield* response.json) as any[]
          expect(Array.isArray(body)).toBe(true)
          expect(body[0].trackSlug).toBe('typescript')
        })
      ))

    it('GET /progress/stats with valid token returns 200', () =>
      runTest(
        Effect.gen(function* () {
          const token = yield* getAuthToken()
          const response = yield* HttpClient.get('/progress/stats', {
            headers: { authorization: `Bearer ${token}` },
          })
          expect(response.status).toBe(200)
          const body = (yield* response.json) as any
          expect(body.totalExercisesCompleted).toBe(3)
          expect(body.currentStreak).toBe(2)
        })
      ))

    it('GET /progress/exercises/:exerciseId with valid token returns 200', () =>
      runTest(
        Effect.gen(function* () {
          const token = yield* getAuthToken()
          const response = yield* HttpClient.get('/progress/exercises/exercise-1', {
            headers: { authorization: `Bearer ${token}` },
          })
          expect(response.status).toBe(200)
          const body = (yield* response.json) as any
          expect(body.isCompleted).toBe(true)
        })
      ))

    it('GET /progress/concepts/:conceptId with valid token returns 200', () =>
      runTest(
        Effect.gen(function* () {
          const token = yield* getAuthToken()
          const response = yield* HttpClient.get('/progress/concepts/concept-1', {
            headers: { authorization: `Bearer ${token}` },
          })
          expect(response.status).toBe(200)
          const body = (yield* response.json) as any
          expect(body.masteryLevel).toBe(0.5)
        })
      ))

    it('GET /progress/tracks/:trackSlug with valid token returns 200', () =>
      runTest(
        Effect.gen(function* () {
          const token = yield* getAuthToken()
          const response = yield* HttpClient.get('/progress/tracks/typescript', {
            headers: { authorization: `Bearer ${token}` },
          })
          expect(response.status).toBe(200)
          const body = (yield* response.json) as any[]
          expect(Array.isArray(body)).toBe(true)
          expect(body[0].conceptSlug).toBe('basics')
        })
      ))

    it('GET /progress/activity with valid token returns 200', () =>
      runTest(
        Effect.gen(function* () {
          const token = yield* getAuthToken()
          const response = yield* HttpClient.get('/progress/activity', {
            headers: { authorization: `Bearer ${token}` },
          })
          expect(response.status).toBe(200)
          const body = (yield* response.json) as any[]
          expect(Array.isArray(body)).toBe(true)
          expect(body.length).toBeGreaterThanOrEqual(1)
        })
      ))
  })

  // -------------------------------------------------------------------------
  // Protected endpoints — Exercises (auth required for some)
  // -------------------------------------------------------------------------

  describe('Exercises (protected)', () => {
    it('GET /exercises/:id/progress without token returns 401', () =>
      runTest(
        Effect.gen(function* () {
          const response = yield* HttpClient.get('/exercises/exercise-1/progress')
          expect(response.status).toBe(401)
        })
      ))

    it('GET /exercises/:id/progress with valid token returns 200', () =>
      runTest(
        Effect.gen(function* () {
          const token = yield* getAuthToken()
          const response = yield* HttpClient.get('/exercises/exercise-1/progress', {
            headers: { authorization: `Bearer ${token}` },
          })
          expect(response.status).toBe(200)
          const body = (yield* response.json) as any
          expect(body.exercise.id).toBe('exercise-1')
          expect(body.codeSource).toBe('starter')
        })
      ))

    it('POST /exercises/:id/draft with valid token saves draft', () =>
      runTest(
        Effect.gen(function* () {
          const token = yield* getAuthToken()
          const response = yield* HttpClient.post('/exercises/exercise-1/draft', {
            headers: { authorization: `Bearer ${token}` },
            body: HttpBody.unsafeJson({ code: 'const x = 42' }),
          })
          expect(response.status).toBe(200)
          const body = (yield* response.json) as any
          expect(body.success).toBe(true)
        })
      ))

    it('DELETE /exercises/:id/draft with valid token returns 200', () =>
      runTest(
        Effect.gen(function* () {
          const token = yield* getAuthToken()
          const response = yield* HttpClient.del('/exercises/exercise-1/draft', {
            headers: { authorization: `Bearer ${token}` },
          })
          expect(response.status).toBe(200)
          const body = (yield* response.json) as any
          expect(body.success).toBe(true)
        })
      ))
  })

  // -------------------------------------------------------------------------
  // Protected endpoints — Submissions (auth required)
  // -------------------------------------------------------------------------

  describe('Submissions (protected)', () => {
    it('POST /submissions without token returns 401', () =>
      runTest(
        Effect.gen(function* () {
          const response = yield* HttpClient.post('/submissions', {
            body: HttpBody.unsafeJson({
              exerciseId: 'exercise-1',
              code: 'const x = 1',
            }),
          })
          expect(response.status).toBe(401)
        })
      ))

    it('POST /submissions with valid token creates submission', () =>
      runTest(
        Effect.gen(function* () {
          const token = yield* getAuthToken()
          // exerciseId must be a valid UUID per Schema.UUID validation
          const response = yield* HttpClient.post('/submissions', {
            headers: { authorization: `Bearer ${token}` },
            body: HttpBody.unsafeJson({
              exerciseId: '00000000-0000-0000-0000-000000000001',
              code: 'const x = 1',
            }),
          })
          expect(response.status).toBe(200)
          const body = (yield* response.json) as any
          expect(body.status).toBe('pending')
        })
      ))

    it('GET /submissions/:id with valid token returns submission', () =>
      runTest(
        Effect.gen(function* () {
          const token = yield* getAuthToken()
          const response = yield* HttpClient.get('/submissions/submission-1', {
            headers: { authorization: `Bearer ${token}` },
          })
          expect(response.status).toBe(200)
          const body = (yield* response.json) as any
          expect(body.id).toBe('submission-1')
        })
      ))

    it('GET /submissions with valid token returns submission list', () =>
      runTest(
        Effect.gen(function* () {
          const token = yield* getAuthToken()
          const response = yield* HttpClient.get('/submissions', {
            headers: { authorization: `Bearer ${token}` },
          })
          expect(response.status).toBe(200)
          const body = (yield* response.json) as any[]
          expect(Array.isArray(body)).toBe(true)
        })
      ))

    it('POST /submissions/:id/retry with valid token retries submission', () =>
      runTest(
        Effect.gen(function* () {
          const token = yield* getAuthToken()
          const response = yield* HttpClient.post('/submissions/submission-1/retry', {
            headers: { authorization: `Bearer ${token}` },
          })
          expect(response.status).toBe(200)
          const body = (yield* response.json) as any
          expect(body.status).toBe('pending')
        })
      ))
  })
})
