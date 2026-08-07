#!/usr/bin/env bash
#
# Runs the app locally against the preview database and Vercel Sandbox, so a
# submission executes for real instead of needing Docker.
#
# It writes .env.development.local, which dotenv-mono loads ahead of .env and
# which .gitignore already covers. Nothing here touches production.
#
#   bash scripts/dev-against-preview.sh   # write the env file
#   bun run dev                           # then start as usual
#
# Where each value comes from, and why not all of them from one place:
#
#   Stripe / Resend     tvault project `blankcode-preview`, which is where the
#                       keys live. Vercel stores them sensitive, so the pull
#                       returns the literal [SENSITIVE].
#   VERCEL_OIDC_TOKEN   `vercel env pull`. This is what authenticates
#                       Sandbox.create() off-platform. It is short lived —
#                       re-run this script when sandboxes start returning 401.
#   DATABASE_URL        neonctl, pointed at the `preview` branch. Not from the
#                       pull: it is stored Sensitive, so the pull returns the
#                       literal string [SENSITIVE].
#   JWT_SECRET          generated here. It only has to be stable across
#                       restarts of your own machine; matching preview's would
#                       let a local token authenticate against preview, which
#                       is not something to make easy by accident.
#   SANDBOX_SNAPSHOT_*  the pull, when they are readable. See the note at the
#                       bottom if they are not.
set -euo pipefail

cd "$(dirname "$0")/.."

TEAM=the-lacanians
NEON_PROJECT=wispy-mouse-91829673
OUT=.env.development.local
PULLED=$(mktemp)
trap 'rm -f "$PULLED"' EXIT

echo "==> pulling preview environment (for the OIDC token)"
vercel env pull "$PULLED" --environment=preview --scope "$TEAM" --yes >/dev/null 2>&1

value_of() {
  # Strips the quotes the pull writes, and reports nothing for a masked value.
  local raw
  raw=$(grep -E "^$1=" "$PULLED" | head -1 | cut -d= -f2- | tr -d '"' || true)
  [ "$raw" = "[SENSITIVE]" ] && return 0
  printf '%s' "$raw"
}

oidc=$(value_of VERCEL_OIDC_TOKEN)
if [ -z "$oidc" ]; then
  echo "No VERCEL_OIDC_TOKEN in the pull — sandboxes will not authenticate." >&2
  exit 1
fi

echo "==> reading the preview database from Neon"
database_url=$(neonctl connection-string preview --project-id "$NEON_PROJECT" --pooled)

# Stable across runs so sessions survive a restart, and per-machine so it is
# never the same secret as any deployed environment.
jwt_secret=$(printf 'blankcode-local-%s' "$(hostname)" | shasum -a 256 | cut -d' ' -f1)

{
  echo "# Written by scripts/dev-against-preview.sh — do not commit."
  echo "# Points at the PREVIEW database. Production is never touched from here."
  echo "DATABASE_URL=\"$database_url\""
  echo "JWT_SECRET=\"$jwt_secret\""
  echo "EXECUTION_BACKEND=\"vercel-sandbox\""
  echo "VERCEL_OIDC_TOKEN=\"$oidc\""

  ai_key=$(value_of AI_GATEWAY_API_KEY)
  [ -n "$ai_key" ] && echo "AI_GATEWAY_API_KEY=\"$ai_key\""

  # From tvault, not from the pull: these are stored sensitive in Vercel and
  # come back as the literal [SENSITIVE]. tvault is where they actually live,
  # which is also what makes this file disposable — delete it and re-run.
  for key in STRIPE_SECRET_KEY STRIPE_PRICE_ID STRIPE_WEBHOOK_SECRET RESEND_API_KEY; do
    value=$(tvault get "$key" -p blankcode-preview 2>/dev/null || true)
    [ -n "$value" ] && echo "$key=\"$value\""
  done

  missing=0
  for lang in TYPESCRIPT REACT VUE PYTHON GO RUST; do
    snapshot=$(value_of "SANDBOX_SNAPSHOT_$lang")
    if [ -n "$snapshot" ]; then
      echo "SANDBOX_SNAPSHOT_$lang=\"$snapshot\""
    else
      missing=$((missing + 1))
    fi
  done
  echo "$missing" > "$PULLED.missing"
} > "$OUT"

missing=$(cat "$PULLED.missing"); rm -f "$PULLED.missing"

echo "==> wrote $OUT"
echo "    database   preview branch on Neon"
echo "    execution  vercel-sandbox"

if [ "$missing" -gt 0 ]; then
  cat <<'NOTE'

    snapshots  MISSING — running an exercise will fail with MissingSnapshotError

    This means a snapshot id came back as [SENSITIVE], which is what happens
    when one is stored with the sensitive flag: nobody can read it back, not
    even you. They are ids, not secrets.

    To fix:

        bun run sandbox:build          # prints a fresh id per language
        vercel env add SANDBOX_SNAPSHOT_GO preview \
          --value snap_... --no-sensitive --scope the-lacanians

    `--no-sensitive` is required, not merely omitting `--sensitive`: this
    project defaults new variables to sensitive.
NOTE
fi

echo
echo "Now run:  bun run dev"
