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

    The snapshot ids are stored Sensitive in Vercel, and a sensitive value
    cannot be read back by anyone, including you. They are ids, not secrets;
    storing them that way bought nothing and cost this.

    To recover them once:

        bun run sandbox:build          # prints a fresh id per language
        # then add each one back WITHOUT --sensitive, e.g.
        vercel env add SANDBOX_SNAPSHOT_GO preview --scope the-lacanians

    After that this script picks them up on its own.
NOTE
fi

echo
echo "Now run:  bun run dev"
