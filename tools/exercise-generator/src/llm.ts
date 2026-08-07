/**
 * LLM client for exercise generation, built on the Vercel AI SDK.
 *
 * Every request goes through the Vercel AI Gateway, so there is exactly one
 * credential (`AI_GATEWAY_API_KEY`) and one place to change models. Switching
 * from DeepSeek to Anthropic — or adding a failover chain — is a config edit,
 * not a code change.
 *
 * Model slugs are `provider/model` and use dots for versions
 * (`anthropic/claude-sonnet-4.6`, not `-4-6`). Discover valid ids with
 * `listAvailableModels()` rather than guessing.
 */

import { APICallError, gateway, generateText } from 'ai'

/** DeepSeek's cheap tier: ~20-50x cheaper than frontier models for this task. */
/*
 * Measured, not chosen by preference.
 *
 * With the real validator gating what gets saved, deepseek-v4-flash produced
 * nothing usable across six attempts — the format is exacting (blank markers,
 * a Tests section, no quotes inside a blank) and it kept breaking one rule or
 * another. Sonnet passed on the first try.
 *
 * An exercise is generated once and read by everyone who takes it, so the
 * cheaper model is only cheaper if its output can be used.
 */
export const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-5'

export interface LlmConfig {
  readonly model: string
  /** Tried in order if the primary model is unavailable. */
  readonly fallbackModels: readonly string[]
  readonly maxOutputTokens: number
  readonly temperature: number
  readonly maxRetries: number
}

export class LlmError extends Error {
  readonly statusCode: number | undefined

  constructor(message: string, statusCode?: number) {
    super(message)
    this.name = 'LlmError'
    this.statusCode = statusCode
  }
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function envFloat(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * True when the gateway is usable. Without a key the generator falls back to
 * offline placeholder content instead of failing, which keeps the rest of the
 * content pipeline testable with no credentials.
 */
export function isGatewayConfigured(): boolean {
  return Boolean(process.env['AI_GATEWAY_API_KEY'] || process.env['VERCEL_OIDC_TOKEN'])
}

export function resolveConfig(): LlmConfig {
  if (!isGatewayConfigured()) {
    throw new Error(
      'AI_GATEWAY_API_KEY is not set. Add it to .env (https://vercel.com/docs/ai-gateway) or run without a key to emit placeholder exercises.'
    )
  }

  const fallbackModels = (process.env['LLM_FALLBACK_MODELS'] ?? '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean)

  return {
    model: process.env['LLM_MODEL'] ?? DEFAULT_MODEL,
    fallbackModels,
    maxOutputTokens: envInt('LLM_MAX_TOKENS', 4000),
    // A little variety matters here: generating exercise 002 for a concept
    // should not reproduce exercise 001 verbatim.
    temperature: envFloat('LLM_TEMPERATURE', 0.6),
    maxRetries: envInt('LLM_MAX_RETRIES', 2),
  }
}

/** Human-readable summary used by the CLI so model choices stay visible. */
export function describeConfig(config: LlmConfig): string {
  const fallbacks = config.fallbackModels.length
    ? ` (fallback: ${config.fallbackModels.join(', ')})`
    : ''
  return `${config.model} via AI Gateway${fallbacks}`
}

/** Lists the model ids the gateway currently exposes. */
export async function listAvailableModels(): Promise<string[]> {
  const { models } = await gateway.getAvailableModels()
  return models.map((model) => model.id).sort()
}

export interface LlmResult {
  readonly text: string
  readonly inputTokens: number | undefined
  readonly outputTokens: number | undefined
}

function toLlmError(error: unknown): LlmError {
  if (APICallError.isInstance(error)) {
    const hint =
      error.statusCode === 402
        ? ' — AI Gateway budget exhausted; top up credits or raise the limit.'
        : error.statusCode === 429
          ? ' — rate limited by the gateway or upstream provider.'
          : error.statusCode === 404
            ? ' — unknown model slug; check `listAvailableModels()`.'
            : ''
    return new LlmError(`AI Gateway request failed: ${error.message}${hint}`, error.statusCode)
  }
  return new LlmError(error instanceof Error ? error.message : String(error))
}

/**
 * Sends a single-turn prompt through the gateway. Transient failures are
 * retried by the AI SDK itself; model-level failover is handled by the gateway
 * when `LLM_FALLBACK_MODELS` is set.
 */
export async function complete(config: LlmConfig, prompt: string): Promise<LlmResult> {
  try {
    const result = await generateText({
      model: config.model,
      prompt,
      temperature: config.temperature,
      maxOutputTokens: config.maxOutputTokens,
      maxRetries: config.maxRetries,
      providerOptions: {
        gateway: {
          // Tags show up in the Vercel AI Gateway dashboard, so exercise
          // generation spend is attributable separately from anything else.
          tags: ['app:blankcode', 'feature:exercise-generation'],
          ...(config.fallbackModels.length > 0 && { models: [...config.fallbackModels] }),
        },
      },
    })

    if (!result.text.trim()) {
      throw new LlmError('Model returned an empty response')
    }

    return {
      text: result.text,
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
    }
  } catch (error) {
    if (error instanceof LlmError) throw error
    throw toLlmError(error)
  }
}
