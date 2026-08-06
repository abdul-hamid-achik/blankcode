import { APICallError } from 'ai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  complete,
  DEFAULT_MODEL,
  describeConfig,
  isGatewayConfigured,
  LlmError,
  resolveConfig,
} from '../llm.js'

// ESM namespaces are frozen, so `generateText` cannot be spied on after import.
// Replace it at module-resolution time and keep everything else (notably the
// real `APICallError` class) intact.
const generateTextMock = vi.hoisted(() => vi.fn())

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return { ...actual, generateText: generateTextMock }
})

const LLM_ENV_VARS = [
  'AI_GATEWAY_API_KEY',
  'VERCEL_OIDC_TOKEN',
  'LLM_MODEL',
  'LLM_FALLBACK_MODELS',
  'LLM_MAX_TOKENS',
  'LLM_TEMPERATURE',
  'LLM_MAX_RETRIES',
] as const

let savedEnv: Record<string, string | undefined> = {}

beforeEach(() => {
  savedEnv = {}
  for (const key of LLM_ENV_VARS) {
    savedEnv[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of LLM_ENV_VARS) {
    const value = savedEnv[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
  generateTextMock.mockReset()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('isGatewayConfigured', () => {
  it('is false with no credentials', () => {
    expect(isGatewayConfigured()).toBe(false)
  })

  it('is true with an explicit gateway key', () => {
    process.env['AI_GATEWAY_API_KEY'] = 'vck_test'
    expect(isGatewayConfigured()).toBe(true)
  })

  it('is true with a Vercel OIDC token', () => {
    process.env['VERCEL_OIDC_TOKEN'] = 'oidc-token'
    expect(isGatewayConfigured()).toBe(true)
  })
})

describe('resolveConfig', () => {
  it('refuses to build a config without a gateway credential', () => {
    expect(() => resolveConfig()).toThrow(/AI_GATEWAY_API_KEY is not set/)
  })

  it('defaults to the cheap DeepSeek model on the gateway', () => {
    process.env['AI_GATEWAY_API_KEY'] = 'vck_test'
    const config = resolveConfig()
    expect(config.model).toBe(DEFAULT_MODEL)
    expect(config.model).toBe('deepseek/deepseek-v4-flash')
    expect(config.fallbackModels).toEqual([])
  })

  it('allows overriding the model with any gateway slug', () => {
    process.env['AI_GATEWAY_API_KEY'] = 'vck_test'
    process.env['LLM_MODEL'] = 'anthropic/claude-sonnet-4.6'
    expect(resolveConfig().model).toBe('anthropic/claude-sonnet-4.6')
  })

  it('parses a comma-separated failover chain', () => {
    process.env['AI_GATEWAY_API_KEY'] = 'vck_test'
    process.env['LLM_FALLBACK_MODELS'] = 'deepseek/deepseek-v4-pro, anthropic/claude-haiku-4.5'
    expect(resolveConfig().fallbackModels).toEqual([
      'deepseek/deepseek-v4-pro',
      'anthropic/claude-haiku-4.5',
    ])
  })

  it('ignores blank entries in the failover chain', () => {
    process.env['AI_GATEWAY_API_KEY'] = 'vck_test'
    process.env['LLM_FALLBACK_MODELS'] = ' , ,'
    expect(resolveConfig().fallbackModels).toEqual([])
  })

  it('falls back to sane defaults when tuning vars are unparseable', () => {
    process.env['AI_GATEWAY_API_KEY'] = 'vck_test'
    process.env['LLM_MAX_TOKENS'] = 'not-a-number'
    process.env['LLM_TEMPERATURE'] = 'hot'
    const config = resolveConfig()
    expect(config.maxOutputTokens).toBe(4000)
    expect(config.temperature).toBe(0.6)
  })

  it('reads tuning vars when they are valid', () => {
    process.env['AI_GATEWAY_API_KEY'] = 'vck_test'
    process.env['LLM_MAX_TOKENS'] = '8000'
    process.env['LLM_TEMPERATURE'] = '0.2'
    process.env['LLM_MAX_RETRIES'] = '5'
    const config = resolveConfig()
    expect(config.maxOutputTokens).toBe(8000)
    expect(config.temperature).toBe(0.2)
    expect(config.maxRetries).toBe(5)
  })
})

describe('describeConfig', () => {
  it('names the model and the gateway', () => {
    process.env['AI_GATEWAY_API_KEY'] = 'vck_test'
    expect(describeConfig(resolveConfig())).toBe('deepseek/deepseek-v4-flash via AI Gateway')
  })

  it('mentions the failover chain when one is configured', () => {
    process.env['AI_GATEWAY_API_KEY'] = 'vck_test'
    process.env['LLM_FALLBACK_MODELS'] = 'anthropic/claude-haiku-4.5'
    expect(describeConfig(resolveConfig())).toContain('fallback: anthropic/claude-haiku-4.5')
  })
})

/**
 * `complete` delegates transport and retries to the AI SDK, so these cover the
 * seams this module actually owns: request shape, empty output, and turning
 * gateway HTTP failures into an actionable message.
 */
describe('complete', () => {
  function gatewayConfig() {
    process.env['AI_GATEWAY_API_KEY'] = 'vck_test'
    return resolveConfig()
  }

  function apiError(statusCode: number, message: string) {
    return new APICallError({
      message,
      statusCode,
      url: 'https://ai-gateway.vercel.sh',
      requestBodyValues: {},
    })
  }

  function mockGenerateText(impl: (options: Record<string, unknown>) => unknown) {
    generateTextMock.mockImplementation(impl as never)
  }

  it('sends the configured model, sampling settings, and cost tags', async () => {
    let captured: Record<string, unknown> = {}
    mockGenerateText((options) => {
      captured = options
      return { text: 'generated', usage: { inputTokens: 10, outputTokens: 20 } }
    })

    const result = await complete(gatewayConfig(), 'hello')

    expect(result.text).toBe('generated')
    expect(result.inputTokens).toBe(10)
    expect(result.outputTokens).toBe(20)

    expect(captured['model']).toBe('deepseek/deepseek-v4-flash')
    expect(captured['prompt']).toBe('hello')
    expect(captured['temperature']).toBe(0.6)
    expect(captured['maxOutputTokens']).toBe(4000)

    const providerOptions = captured['providerOptions'] as Record<string, Record<string, unknown>>
    expect(providerOptions['gateway']?.['tags']).toEqual([
      'app:blankcode',
      'feature:exercise-generation',
    ])
    // No failover configured, so no `models` key should be sent at all.
    expect(providerOptions['gateway']).not.toHaveProperty('models')
  })

  it('forwards the failover chain to the gateway when configured', async () => {
    let captured: Record<string, unknown> = {}
    mockGenerateText((options) => {
      captured = options
      return { text: 'ok', usage: {} }
    })

    process.env['AI_GATEWAY_API_KEY'] = 'vck_test'
    process.env['LLM_FALLBACK_MODELS'] = 'anthropic/claude-haiku-4.5'
    await complete(resolveConfig(), 'hello')

    const providerOptions = captured['providerOptions'] as Record<string, Record<string, unknown>>
    expect(providerOptions['gateway']?.['models']).toEqual(['anthropic/claude-haiku-4.5'])
  })

  it('surfaces an empty completion as an error rather than writing an empty file', async () => {
    mockGenerateText(() => ({ text: '   ', usage: {} }))
    await expect(complete(gatewayConfig(), 'hello')).rejects.toBeInstanceOf(LlmError)
  })

  it('explains a 402 as an exhausted gateway budget', async () => {
    mockGenerateText(() => {
      throw apiError(402, 'Payment Required')
    })
    await expect(complete(gatewayConfig(), 'hello')).rejects.toThrow(/budget exhausted/)
  })

  it('explains a 404 as a bad model slug', async () => {
    mockGenerateText(() => {
      throw apiError(404, 'Not Found')
    })
    await expect(complete(gatewayConfig(), 'hello')).rejects.toThrow(/unknown model slug/)
  })

  it('preserves the HTTP status on the thrown error', async () => {
    mockGenerateText(() => {
      throw apiError(429, 'Too Many Requests')
    })
    await expect(complete(gatewayConfig(), 'hello')).rejects.toMatchObject({ statusCode: 429 })
  })
})
