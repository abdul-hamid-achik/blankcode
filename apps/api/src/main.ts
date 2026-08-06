import { createServer } from 'node:http'
import { HttpApiBuilder, HttpMiddleware, HttpServer } from '@effect/platform'
import { NodeHttpServer, NodeRuntime } from '@effect/platform-node'
import { Layer } from 'effect'
import { ApiLive } from './app.js'
import { config } from './config/index.js'

/**
 * Standalone Node server. Used for local development and `docker compose up`;
 * in production the same `ApiLive` is mounted inside Nitro (see
 * `apps/web/server/routes/api/[...].ts`), so this process is not deployed.
 */

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
