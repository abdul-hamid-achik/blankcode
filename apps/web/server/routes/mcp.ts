import { createDatabaseFromEnv } from '@blankcode/db/client'
import { apiTokens, harnessSessions } from '@blankcode/db/schema'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { and, eq, gt, isNull, sql } from 'drizzle-orm'
import { buildPracticeServer } from '../utils/mcp-server'
import { hashPracticeToken, isPracticeToken } from '../utils/practice-tokens'

/**
 * The MCP endpoint: `https://blankcode.dev/mcp`.
 *
 * Stateless streamable HTTP — a fresh server instance per request, because
 * that is the one MCP mode that behaves in serverless, and every fact that
 * matters lives in Postgres anyway. GET (the SSE channel) and DELETE (session
 * teardown) are refused: with no session there is nothing to stream or tear
 * down, and saying 405 plainly beats holding a connection that will never
 * speak.
 *
 * Auth is a practice token only. A web JWT is refused here on purpose: the
 * session belongs in a browser, and an agent should never be holding one.
 */

/** One practice sitting: tool calls closer together than this share a session. */
const SESSION_WINDOW_MS = 30 * 60 * 1000

/** A wall against runaway loops, not a quota — the daily cap guards spend. */
const MAX_CALLS_PER_WINDOW = 2000

export default defineEventHandler(async (event) => {
  if (event.method !== 'POST') {
    setResponseHeader(event, 'Allow', 'POST')
    throw createError({
      statusCode: 405,
      statusMessage: 'This MCP server is stateless: POST only.',
    })
  }

  // ── Authentication ──────────────────────────────────────────────────────
  const authorization = getHeader(event, 'authorization') ?? ''
  const bearer = authorization.replace(/^Bearer\s+/i, '')

  if (!bearer || !isPracticeToken(bearer)) {
    setResponseHeader(event, 'WWW-Authenticate', 'Bearer realm="blankcode", charset="UTF-8"')
    throw createError({
      statusCode: 401,
      statusMessage:
        'A practice token is required (Authorization: Bearer bck_…). Mint one at blankcode.dev/settings.',
    })
  }

  const db = createDatabaseFromEnv()
  const tokenRow = await db.query.apiTokens.findFirst({
    where: and(eq(apiTokens.token, hashPracticeToken(bearer)), isNull(apiTokens.revokedAt)),
    columns: { id: true, userId: true },
  })

  if (!tokenRow) {
    setResponseHeader(event, 'WWW-Authenticate', 'Bearer realm="blankcode", charset="UTF-8"')
    throw createError({ statusCode: 401, statusMessage: 'Invalid or revoked practice token.' })
  }

  const body = await readBody(event)

  // ── The implicit session ────────────────────────────────────────────────
  // Upserted per call, never client-declared: a session an agent reports is
  // a claim, and agents are bad bookkeepers. clientInfo is captured from the
  // initialize request when one happens to open the window.
  const clientInfo =
    body?.method === 'initialize'
      ? (body?.params?.clientInfo as { name?: string; version?: string } | undefined)
      : undefined

  const windowStart = new Date(Date.now() - SESSION_WINDOW_MS)
  const [session] = await db
    .update(harnessSessions)
    .set({
      lastSeenAt: new Date(),
      toolCalls: sql`${harnessSessions.toolCalls} + 1`,
      ...(clientInfo?.name ? { clientName: clientInfo.name } : {}),
      ...(clientInfo?.version ? { clientVersion: clientInfo.version } : {}),
    })
    .where(
      and(eq(harnessSessions.apiTokenId, tokenRow.id), gt(harnessSessions.lastSeenAt, windowStart))
    )
    .returning({ toolCalls: harnessSessions.toolCalls })

  if (!session) {
    await db.insert(harnessSessions).values({
      userId: tokenRow.userId,
      apiTokenId: tokenRow.id,
      clientName: clientInfo?.name ?? null,
      clientVersion: clientInfo?.version ?? null,
      toolCalls: 1,
    })
  } else if (session.toolCalls > MAX_CALLS_PER_WINDOW) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many calls this session. Take a breath; the window resets in 30 minutes.',
    })
  }

  // ── Serve ───────────────────────────────────────────────────────────────
  // Tools proxy onto the same API the browser uses, presenting the caller's
  // own token — so the practice-scope allowlist, redaction, the daily cap,
  // via-labeling, and the SM-2 gate all apply identically. One product.
  // Cast once: Nitro's typed $fetch tries to infer the route union from a
  // dynamic string and blows the type-checker's stack. These are internal
  // calls to our own API; the response types are owned by the API schemas.
  const internalFetch = $fetch as unknown as (
    path: string,
    opts?: Record<string, unknown>
  ) => Promise<unknown>

  const server = buildPracticeServer({
    bearer,
    fetcher: (path, init) =>
      internalFetch(path, {
        method: init?.method ?? 'GET',
        headers: { Authorization: `Bearer ${bearer}` },
        ...(init?.body !== undefined ? { body: init.body } : {}),
      }),
  })

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })

  event.node.res.on('close', () => {
    void transport.close()
    void server.close()
  })

  await server.connect(transport)
  await transport.handleRequest(event.node.req, event.node.res, body)
})
