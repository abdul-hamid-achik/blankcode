/**
 * BlankCode operator seed.
 *
 * One command that makes Stripe, tvault and Vercel agree about the plan. Run it
 * again after changing a price or a limit; it is an upsert, not a first-run
 * script.
 *
 *   bun run seed                 # sandbox → tvault blankcode-preview, Vercel preview+development
 *   bun run seed -- --live       # live    → tvault blankcode,         Vercel production
 *
 * Flags:
 *   --live              operate on live Stripe and production
 *   --no-push           do not write to tvault or Vercel, only reconcile Stripe
 *   --no-webhook        skip creating/reconciling the webhook endpoint
 *   --dry-run           print what would change and write nothing
 *
 * Secrets are read from tvault and passed to `vercel env add --value`. They are
 * never printed: everything this logs is a name, an id, or a decision. That is
 * the point of it existing instead of a shell script that echoes keys.
 */

import { spawnSync } from 'node:child_process'
import Stripe from 'stripe'

// ---------------------------------------------------------------- configuration

const PRODUCT_NAME = 'BlankCode Unlimited'
const PRODUCT_DESCRIPTION =
  'No daily submission limit, unmetered explanations, the full review queue.'

/**
 * The plan, in one place.
 *
 * MXN is the base because Adaptive Pricing requires the price to be in a
 * settlement currency, and a Mexican Stripe account settles only in MXN —
 * multi-currency settlement is not offered there. A USD-based price is silently
 * ineligible, which is how the first attempt at this went.
 *
 * The other two are exact amounts rather than conversions, so those markets see
 * a round number. Everywhere else Adaptive Pricing converts and the customer
 * pays the 2–4% fee instead of us.
 */
const PLAN = {
  baseCurrency: 'mxn',
  amounts: { mxn: 21_900, usd: 1_200, eur: 1_100 },
  interval: 'month',
} as const

const WEBHOOK_EVENTS = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
] as const

const ORIGINS = {
  live: 'https://blankcode.dev',
  sandbox: 'https://preview.blankcode.dev',
} as const

const VAULTS = { live: 'blankcode', sandbox: 'blankcode-preview' } as const
const VERCEL_ENVS = {
  live: ['production'],
  sandbox: ['preview', 'development'],
} as const
const TEAM = 'the-lacanians'

// ---------------------------------------------------------------------- helpers

function fail(message: string): never {
  console.error(`\n  ✗ ${message}\n`)
  process.exit(1)
}

function run(command: string, args: string[]): { ok: boolean; out: string } {
  const result = spawnSync(command, args, { encoding: 'utf8' })
  return {
    ok: result.status === 0,
    out: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim(),
  }
}

/** Reads a secret from tvault. The value is returned, never logged. */
function vaultGet(project: string, key: string): string | null {
  const result = run('tvault', ['get', key, '-p', project])
  if (!result.ok) return null
  const value = result.out.trim()
  return value.length > 0 ? value : null
}

function vaultSet(project: string, key: string, value: string, dryRun: boolean): void {
  if (dryRun) {
    console.log(`    would set ${key} in tvault:${project}`)
    return
  }
  const result = run('tvault', ['set', key, value, '-p', project])
  if (!result.ok) fail(`tvault set ${key} -p ${project}: ${result.out}`)
  console.log(`    ${key} → tvault:${project}`)
}

/**
 * Writes one variable to Vercel.
 *
 * `sensitive` is a parameter and not a default because getting it wrong in
 * either direction has a cost: a key stored non-sensitive is readable by anyone
 * with project access, and an *identifier* stored sensitive cannot be read back
 * by anyone at all — which is what made the sandbox snapshot ids unrecoverable
 * and cost a rebuild.
 */
function vercelSet(
  name: string,
  value: string,
  environments: readonly string[],
  sensitive: boolean,
  dryRun: boolean
): void {
  for (const environment of environments) {
    /*
     * Vercel refuses --sensitive on Development, and the obvious workaround —
     * storing it plainly there — is worse than not storing it. Development
     * variables exist to be pulled onto a laptop, and a laptop gets its keys
     * from tvault. So a secret simply does not go to that environment.
     */
    if (sensitive && environment === 'development') {
      console.log(`    ${name} skipped in vercel:development (secrets live in tvault)`)
      continue
    }

    if (dryRun) {
      console.log(
        `    would set ${name} in vercel:${environment} (${sensitive ? 'sensitive' : 'non-sensitive'})`
      )
      continue
    }
    run('vercel', ['env', 'rm', name, environment, '--scope', TEAM, '--yes'])
    const result = run('vercel', [
      'env',
      'add',
      name,
      environment,
      '--value',
      value,
      sensitive ? '--sensitive' : '--no-sensitive',
      '--scope',
      TEAM,
    ])
    if (!result.ok) fail(`vercel env add ${name} ${environment}: ${result.out}`)
    console.log(`    ${name} → vercel:${environment} (${sensitive ? 'sensitive' : 'plain'})`)
  }
}

// ------------------------------------------------------------------------- main

const argv = new Set(process.argv.slice(2))
const live = argv.has('--live')
const noPush = argv.has('--no-push')
const noWebhook = argv.has('--no-webhook')
const dryRun = argv.has('--dry-run')

const mode = live ? 'live' : 'sandbox'
const vault = VAULTS[mode]
const origin = ORIGINS[mode]
const environments = VERCEL_ENVS[mode]

console.log(`\n  BlankCode seed — ${mode}`)
console.log(`  vault ${vault} · vercel ${environments.join(', ')}${dryRun ? ' · DRY RUN' : ''}\n`)

const secretKey = vaultGet(vault, 'STRIPE_SECRET_KEY')
if (!secretKey) {
  fail(
    `No STRIPE_SECRET_KEY in tvault:${vault}.\n` +
      `    tvault set STRIPE_SECRET_KEY ${live ? 'sk_live_...' : 'sk_test_...'} -p ${vault}`
  )
}

const expectedPrefix = live ? 'sk_live_' : 'sk_test_'
if (!secretKey.startsWith(expectedPrefix)) {
  // Worth failing over: a test key in production means nobody is ever charged
  // and it looks like it works, and a live key in preview charges real cards
  // during testing.
  fail(
    `The key in tvault:${vault} is not a ${live ? 'live' : 'test'} key. ` +
      `Expected it to start with ${expectedPrefix}.`
  )
}

const stripe = new Stripe(secretKey)

console.log('  Stripe')

const products = await stripe.products.search({ query: `name:"${PRODUCT_NAME}"`, limit: 1 })
let product = products.data[0]
if (!product) {
  if (dryRun) {
    console.log('    would create product')
    product = { id: '(would create)' } as Stripe.Product
  } else {
    product = await stripe.products.create({
      name: PRODUCT_NAME,
      description: PRODUCT_DESCRIPTION,
    })
    console.log(`    product created ${product.id}`)
  }
} else {
  console.log(`    product ${product.id}`)
}

// Read even on a dry run. Reads are free of consequence, and a dry run that
// skips them reports "would create" for things that already exist — which is
// worse than not running it, because it looks like an answer.
const existingPrices =
  product.id === '(would create)'
    ? { data: [] as Stripe.Price[] }
    : await stripe.prices.list({ product: product.id, active: true, limit: 100 })

/** The price we want: right base currency, right amounts, monthly. */
function matches(price: Stripe.Price): boolean {
  if (price.currency !== PLAN.baseCurrency) return false
  if (price.unit_amount !== PLAN.amounts[PLAN.baseCurrency]) return false
  if (price.recurring?.interval !== PLAN.interval) return false
  return true
}

let price = existingPrices.data.find(matches)
if (!price) {
  if (dryRun) {
    console.log(`    would create price ${PLAN.amounts.mxn} mxn + usd/eur options`)
    price = { id: '(would create)' } as Stripe.Price
  } else {
    /*
     * A price is immutable in Stripe, so "changing the plan" means creating a
     * new one and archiving the old. Existing subscribers keep the price they
     * signed up on — which is the behaviour you want, and the reason this
     * archives rather than deletes.
     */
    for (const stale of existingPrices.data) {
      await stripe.prices.update(stale.id, { active: false })
      console.log(`    archived ${stale.id}`)
    }
    price = await stripe.prices.create({
      product: product.id,
      currency: PLAN.baseCurrency,
      unit_amount: PLAN.amounts[PLAN.baseCurrency],
      recurring: { interval: PLAN.interval },
      currency_options: {
        usd: { unit_amount: PLAN.amounts.usd },
        eur: { unit_amount: PLAN.amounts.eur },
      },
    })
    console.log(`    price created ${price.id}`)
  }
} else {
  console.log(`    price ${price.id}`)
}

let webhookSecret: string | null = vaultGet(vault, 'STRIPE_WEBHOOK_SECRET')

if (!noWebhook && !dryRun) {
  const url = `${origin}/api/billing/webhook`
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 })
  const existing = endpoints.data.find((endpoint) => endpoint.url === url)

  if (existing) {
    await stripe.webhookEndpoints.update(existing.id, { enabled_events: [...WEBHOOK_EVENTS] })
    console.log(`    webhook ${existing.id} (events reconciled)`)
    if (!webhookSecret) {
      // Stripe returns the signing secret only at creation. An endpoint that
      // already exists cannot hand it over again.
      console.log(`    ! no STRIPE_WEBHOOK_SECRET in tvault and this endpoint cannot reveal it.`)
      console.log(
        `      Roll it in the Dashboard, then: tvault set STRIPE_WEBHOOK_SECRET whsec_... -p ${vault}`
      )
    }
  } else {
    const created = await stripe.webhookEndpoints.create({
      url,
      enabled_events: [...WEBHOOK_EVENTS],
      description: `BlankCode ${mode}`,
    })
    console.log(`    webhook created ${created.id}`)
    if (created.secret) {
      webhookSecret = created.secret
      vaultSet(vault, 'STRIPE_WEBHOOK_SECRET', created.secret, dryRun)
    }
  }
}

if (noPush) {
  console.log('\n  --no-push: nothing written to tvault or Vercel\n')
  process.exit(0)
}

console.log('\n  tvault')
vaultSet(vault, 'STRIPE_PRODUCT_ID', product.id, dryRun)
vaultSet(vault, 'STRIPE_PRICE_ID', price.id, dryRun)

/*
 * Anything else the runtime needs that lives in the vault.
 *
 * Listed rather than "push everything": the vault also holds values that must
 * not reach a deployment, and a loop over its contents would ship them the
 * first time someone stored one.
 */
const RUNTIME_SECRETS = ['RESEND_API_KEY'] as const

/**
 * Config the runtime needs that is not a secret.
 *
 * Pushed non-sensitive so `vercel env pull` can bring it back for local work.
 * An email address is not a credential, and storing one sensitive is how the
 * sandbox snapshot ids became unreadable.
 */
const RUNTIME_CONFIG = ['ADMIN_EMAILS'] as const

console.log('\n  Vercel')
// Identifiers, stored readable on purpose: `vercel env pull` has to be able to
// bring these back for local development.
vercelSet('STRIPE_PRICE_ID', price.id, environments, false, dryRun)
vercelSet('STRIPE_SECRET_KEY', secretKey, environments, true, dryRun)
if (webhookSecret) {
  vercelSet('STRIPE_WEBHOOK_SECRET', webhookSecret, environments, true, dryRun)
} else {
  console.log('    STRIPE_WEBHOOK_SECRET skipped — not in tvault yet')
}

for (const name of RUNTIME_SECRETS) {
  const value = vaultGet(vault, name)
  if (value) {
    vercelSet(name, value, environments, true, dryRun)
  } else {
    console.log(`    ${name} skipped — not in tvault:${vault}`)
  }
}

for (const name of RUNTIME_CONFIG) {
  const value = vaultGet(vault, name)
  if (value) {
    vercelSet(name, value, environments, false, dryRun)
  } else {
    console.log(`    ${name} skipped — not in tvault:${vault}`)
  }
}

console.log('\n  Done.')
console.log(
  '  Vercel needs a fresh build to pick these up; `vercel redeploy` reuses the old one.\n'
)
