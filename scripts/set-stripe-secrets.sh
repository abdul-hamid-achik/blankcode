#!/usr/bin/env bash
#
# Loads the two Stripe credentials into Vercel. Run it yourself — these are
# keys, and I do not type keys into forms on your behalf.
#
#   bash scripts/set-stripe-secrets.sh
#
# STRIPE_PRICE_ID is already set (price_1U1qUIIteSbZiMvIu8q76eYL, non-sensitive,
# all three environments). It is an identifier, not a secret, and storing it
# sensitive is what made the sandbox snapshot ids unreadable earlier today.
#
# What this needs from you first:
#
#   1. The webhook endpoint, created in the Stripe Dashboard for each mode:
#        https://blankcode.dev/api/billing/webhook          (live)
#        https://preview.blankcode.dev/api/billing/webhook  (sandbox)
#      Subscribe it to customer.subscription.created / .updated / .deleted.
#      Stripe shows a signing secret (whsec_…) once — that is what goes below.
#
#   2. Adaptive Pricing turned on, in both modes:
#        Settings → Payments → Checkout → Adaptive Pricing
#      Without it every country sees MXN. There is no API for this; I looked.
set -euo pipefail

TEAM=the-lacanians

echo "==> sandbox keys for preview"
echo "    Get them from: Developers → API keys (sandbox), and your sandbox webhook."
read -rsp "    STRIPE_SECRET_KEY (sk_test_…): " SK_TEST; echo
read -rsp "    STRIPE_WEBHOOK_SECRET (whsec_…): " WH_TEST; echo

for env in preview development; do
  vercel env rm STRIPE_SECRET_KEY "$env" --scope "$TEAM" --yes >/dev/null 2>&1 || true
  printf '%s' "$SK_TEST" | vercel env add STRIPE_SECRET_KEY "$env" --scope "$TEAM" >/dev/null
  vercel env rm STRIPE_WEBHOOK_SECRET "$env" --scope "$TEAM" --yes >/dev/null 2>&1 || true
  printf '%s' "$WH_TEST" | vercel env add STRIPE_WEBHOOK_SECRET "$env" --scope "$TEAM" >/dev/null
  echo "    $env done"
done

echo
echo "==> live keys for production"
echo "    Leave both blank to skip until you are ready to charge real cards."
read -rsp "    STRIPE_SECRET_KEY (sk_live_…): " SK_LIVE; echo
read -rsp "    STRIPE_WEBHOOK_SECRET (whsec_…): " WH_LIVE; echo

if [ -n "$SK_LIVE" ] && [ -n "$WH_LIVE" ]; then
  vercel env rm STRIPE_SECRET_KEY production --scope "$TEAM" --yes >/dev/null 2>&1 || true
  printf '%s' "$SK_LIVE" | vercel env add STRIPE_SECRET_KEY production --scope "$TEAM" >/dev/null
  vercel env rm STRIPE_WEBHOOK_SECRET production --scope "$TEAM" --yes >/dev/null 2>&1 || true
  printf '%s' "$WH_LIVE" | vercel env add STRIPE_WEBHOOK_SECRET production --scope "$TEAM" >/dev/null
  echo "    production done"
else
  echo "    production skipped — billing stays off there, which is the safe default:"
  echo "    the checkout route answers 503 rather than half-working."
fi

echo
echo "Then redeploy. vercel redeploy reuses the previous build and will not"
echo "pick these up — push a commit, or trigger a fresh build."
