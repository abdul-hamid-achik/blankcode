import { ApiLive } from '@blankcode/api/app'
import { HttpApiBuilder, HttpServer } from '@effect/platform'
import { Layer } from 'effect'

/**
 * Mounts the Effect API inside Nitro, so the whole product deploys as one
 * Vercel project instead of a Nuxt site plus a separately-hosted API.
 *
 * The API's routes are defined at the root (`/auth/login`, `/health`), and
 * this route owns the `/api` prefix, so the prefix is stripped before the
 * request reaches the handler. That keeps the route definitions identical
 * between this transport and the standalone Node server — the alternative,
 * declaring `/api` inside every group, would make the two hosts disagree
 * about what a route is called.
 */

const { handler } = HttpApiBuilder.toWebHandler(Layer.mergeAll(ApiLive, HttpServer.layerContext))

export default defineEventHandler(async (event) => {
  const request = toWebRequest(event)
  const url = new URL(request.url)

  // '/api/auth/login' -> '/auth/login'; '/api' -> '/'
  url.pathname = url.pathname.replace(/^\/api(?=\/|$)/, '') || '/'

  return handler(new Request(url, request))
})
