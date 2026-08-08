import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The checkout-starting composable and its two call sites.
 *
 * `useCheckout` exists so the settings page and the pricing section cannot
 * disagree about what "upgrade" does. Source assertions, not a mounted
 * component: `$fetch` and `useCookie` are Nuxt auto-imports that do not exist
 * under plain Vitest (see AGENTS.md), and the property worth pinning here —
 * that both surfaces reuse one implementation rather than each posting to
 * `/api/billing/checkout` by hand — is a source-shape fact, not a behaviour
 * one.
 */

const composable = readFileSync(join(process.cwd(), 'composables/useCheckout.ts'), 'utf-8')
const settingsSection = readFileSync(
  join(process.cwd(), 'components/billing/billing-section.vue'),
  'utf-8'
)
const pricingPlans = readFileSync(
  join(process.cwd(), 'components/landing/pricing-plans.vue'),
  'utf-8'
)

describe('useCheckout', () => {
  it('posts to the checkout endpoint', () => {
    expect(composable).toContain("$fetch<{ url: string }>('/api/billing/checkout'")
    expect(composable).toContain("method: 'POST'")
  })

  it('counts the attempt with the event the analytics module already defines', () => {
    expect(composable).toContain("useAnalytics().emit('checkout-started', { currency: 'mxn' })")
  })

  it('counts before leaving the page, not after', () => {
    // A call placed after the redirect is a call that may never run — the
    // browser is already navigating away.
    const emitted = composable.indexOf("emit('checkout-started'")
    const redirected = composable.indexOf('window.location.href =')
    expect(emitted).toBeGreaterThan(-1)
    expect(redirected).toBeGreaterThan(emitted)
  })

  it('exposes a busy flag so a caller can disable its own button', () => {
    expect(composable).toContain('busy')
    expect(composable).toContain('if (busy.value) return')
  })

  it('surfaces a failure instead of swallowing it', () => {
    expect(composable).toContain('error.value =')
    expect(composable).not.toMatch(/catch\s*{\s*}/)
  })

  it('is the only place in the app that emits checkout-started', () => {
    const appRoot = process.cwd()
    const SKIP = new Set(['node_modules', '.nuxt', '.output', '.histoire', 'dist', '__tests__'])

    function walk(dir: string, found: string[] = []): string[] {
      let entries: string[]
      try {
        entries = readdirSync(dir)
      } catch {
        return found
      }
      for (const entry of entries) {
        if (SKIP.has(entry)) continue
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) {
          walk(full, found)
        } else if (entry.endsWith('.ts') || entry.endsWith('.vue')) {
          found.push(full)
        }
      }
      return found
    }

    const hits = walk(appRoot)
      .filter((file) => readFileSync(file, 'utf-8').includes("emit('checkout-started'"))
      .map((file) => relative(appRoot, file))

    expect(hits).toEqual(['composables/useCheckout.ts'])
  })
})

describe('the settings page plan card', () => {
  it('drives its upgrade button through useCheckout, not a call of its own', () => {
    expect(settingsSection).toContain("import { useCheckout } from '~/composables/useCheckout'")
    expect(settingsSection).toContain('useCheckout()')
    expect(settingsSection).not.toContain('/api/billing/checkout')
  })

  it('shows a busy state and a failure, never swallowed', () => {
    expect(settingsSection).toContain(':loading="checkoutBusy"')
    expect(settingsSection).toContain('checkoutError')
  })

  it('reads the checkout query param for the two redirect outcomes', () => {
    expect(settingsSection).toContain("route.query['checkout']")
    expect(settingsSection).toContain('Payment received')
    expect(settingsSection).toContain('Checkout cancelled')
  })
})

describe('the pricing section', () => {
  it('drives its upgrade button through the same composable', () => {
    expect(pricingPlans).toContain("import { useCheckout } from '~/composables/useCheckout'")
    expect(pricingPlans).toContain('useCheckout()')
    expect(pricingPlans).not.toContain('/api/billing/checkout')
  })

  it('sends a signed-out visitor to create an account first', () => {
    expect(pricingPlans).toContain('auth.isAuthenticated')
    expect(pricingPlans).toContain('to="/register"')
  })

  it('shows a paid account nothing to click', () => {
    expect(pricingPlans).toContain('You are on Pro')
  })
})
