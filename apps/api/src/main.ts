import { createServer } from 'node:http'
import { DatabaseLive } from '@blankcode/db/client'
import * as ClusterWorkflowEngine from '@effect/cluster/ClusterWorkflowEngine'
import * as SingleRunner from '@effect/cluster/SingleRunner'
import { HttpApiBuilder, HttpMiddleware, HttpServer } from '@effect/platform'
import { NodeHttpServer, NodeRuntime } from '@effect/platform-node'
import { Layer } from 'effect'
import { BlankCodeApi } from './api/index.js'
import { config } from './config/index.js'
import { AchievementsHandlers } from './handlers/achievements.handlers.js'
// Handlers
import { AuthHandlers } from './handlers/auth.handlers.js'
import { ExercisesHandlers } from './handlers/exercises.handlers.js'
import { GenerationHandlers } from './handlers/generation.handlers.js'
import { HealthHandlers } from './handlers/health.handlers.js'
import { PathsHandlers } from './handlers/paths.handlers.js'
import { ProgressHandlers } from './handlers/progress.handlers.js'
import { ReviewsHandlers } from './handlers/reviews.handlers.js'
import { SubmissionsHandlers } from './handlers/submissions.handlers.js'
import { TracksHandlers } from './handlers/tracks.handlers.js'
import { UsersHandlers } from './handlers/users.handlers.js'
import { AdminAuthorizationLive } from './middleware/admin.middleware.js'
// Middleware
import { AuthorizationLive } from './middleware/auth.middleware.js'
import { AuthRateLimitLive, SubmissionRateLimitLive } from './middleware/rate-limit.middleware.js'
import { AchievementsServiceLive } from './modules/achievements/achievements.service.js'
import { AuthServiceLive } from './modules/auth/auth.service.js'
import { ExercisesServiceLive } from './modules/exercises/exercises.service.js'
import { GenerationServiceLive } from './modules/generation/generation.service.js'
import { ProgressServiceLive } from './modules/progress/progress.service.js'
import { ReviewsServiceLive } from './modules/reviews/reviews.service.js'
import { SubmissionsServiceLive } from './modules/submissions/submissions.service.js'
import { TracksServiceLive } from './modules/tracks/tracks.service.js'
import { UsersServiceLive } from './modules/users/users.service.js'
// Services
import { JwtServiceLive } from './services/jwt.service.js'
import { GenerationWorkflowLive } from './workflows/generation.handler.js'
// Workflows
import { SubmissionWorkflowLive } from './workflows/submission.handler.js'

// Services layer
const ServicesLive = Layer.mergeAll(
  AuthServiceLive,
  UsersServiceLive,
  TracksServiceLive,
  ExercisesServiceLive,
  SubmissionsServiceLive,
  ProgressServiceLive,
  GenerationServiceLive,
  AchievementsServiceLive,
  ReviewsServiceLive
)

// Middleware layer
const MiddlewareLive = Layer.mergeAll(
  AuthorizationLive,
  AdminAuthorizationLive,
  AuthRateLimitLive,
  SubmissionRateLimitLive
)

// Handler layers
const HandlersLive = Layer.mergeAll(
  AuthHandlers,
  UsersHandlers,
  TracksHandlers,
  ExercisesHandlers,
  SubmissionsHandlers,
  ProgressHandlers,
  GenerationHandlers,
  HealthHandlers,
  PathsHandlers,
  AchievementsHandlers,
  ReviewsHandlers
)

// Workflow engine — SQL-backed via SingleRunner, shared with worker process
// provideMerge keeps WorkflowEngine visible so handlers can call Workflow.execute()
const ClusterLive = Layer.provideMerge(
  ClusterWorkflowEngine.layer,
  SingleRunner.layer({ runnerStorage: 'sql' })
)

const WorkflowLive = Layer.mergeAll(SubmissionWorkflowLive, GenerationWorkflowLive).pipe(
  Layer.provideMerge(ClusterLive),
  Layer.provide(DatabaseLive)
)

// API layer
const ApiLive = HttpApiBuilder.api(BlankCodeApi).pipe(
  Layer.provide(HandlersLive),
  Layer.provide(ServicesLive),
  Layer.provide(MiddlewareLive),
  Layer.provide(JwtServiceLive),
  Layer.provide(WorkflowLive),
  Layer.provide(DatabaseLive)
)

// HTTP Server
const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  // TODO: Re-enable OpenAPI docs once all response schemas use JSON-serializable types
  // Layer.provide(HttpApiScalar.layer({ path: '/docs' })),
  // Layer.provide(HttpApiBuilder.middlewareOpenApi()),
  Layer.provide(
    HttpApiBuilder.middlewareCors({
      allowedOrigins: [config.api.corsOrigin],
      credentials: true,
      allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  ),
  Layer.provide(ApiLive),
  HttpServer.withLogAddress,
  Layer.provide(
    NodeHttpServer.layer(createServer, { port: config.api.port, host: config.api.host })
  )
)

Layer.launch(HttpLive).pipe(NodeRuntime.runMain)
