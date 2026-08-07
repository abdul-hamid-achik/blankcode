#!/usr/bin/env bash
#
# Points preview.blankcode.dev at the newest ready deployment of the `preview`
# branch.
#
# Vercel can track a domain to a git branch, but only from the dashboard: the
# CLI has no flag for it, `vercel project update` only touches build settings,
# and vercel.json has no field for it. `vercel alias set` points a domain at one
# deployment, which works — it just does not follow the next push.
#
# So run this after pushing to `preview`. It uses the Vercel session already on
# this machine, so there is no token to create and no secret to store anywhere.
#
# The permanent alternative is one dashboard click (Settings → Domains →
# preview.blankcode.dev → Git Branch → preview), after which this is redundant.
set -euo pipefail

TEAM=the-lacanians
DOMAIN=preview.blankcode.dev
BRANCH=preview

# `--json` rather than the table: the human-readable table goes to stderr and
# stdout carries bare URLs with no environment on them, so parsing what you see
# on screen gets you production deployments too.
url=$(
  vercel ls --scope "$TEAM" --environment preview --status READY --limit 20 --json 2>/dev/null |
    python3 -c "
import json, sys
data = json.load(sys.stdin)
items = data if isinstance(data, list) else data.get('deployments', data.get('items', []))
# Newest first, and only this branch: other branches also deploy to preview.
for item in items:
    if (item.get('meta') or {}).get('githubCommitRef') == '$BRANCH':
        print(item['url']); break
"
)

if [ -z "${url:-}" ]; then
  echo "No ready preview deployment for branch '$BRANCH'. Push to it first." >&2
  exit 1
fi

echo "newest $BRANCH deployment: https://$url"
vercel alias set "$url" "$DOMAIN" --scope "$TEAM"

echo
echo "verifying:"
for path in / /api/tracks /api/paths; do
  printf '  %-14s %s\n' "$path" "$(curl -s -o /dev/null -w '%{http_code}' "https://$DOMAIN$path")"
done
