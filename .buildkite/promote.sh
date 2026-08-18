#!/usr/bin/env bash
# Promote the Preview deployment for this commit to Production (no rebuild).
# Used when a v* tag is pushed. Requires Buildkite secret VERCEL_TOKEN.
set -euo pipefail

TEAM_ID="${VERCEL_TEAM_ID:-team_orgeS6nZgu4U3F7usRkqY28e}"
SCOPE="${VERCEL_SCOPE:-the-lacanians}"
PROJECT_ID="${VERCEL_PROJECT_ID:?VERCEL_PROJECT_ID is required}"
SHA="${BUILDKITE_COMMIT:?}"
TOKEN="${VERCEL_TOKEN:?set VERCEL_TOKEN in the Buildkite cluster / pipeline secrets}"

echo "Waiting for a READY preview deployment of ${SHA}"

url=""
for _ in $(seq 1 45); do
  json="$(curl -fsS -H "Authorization: Bearer ${TOKEN}" \
    "https://api.vercel.com/v6/deployments?projectId=${PROJECT_ID}&teamId=${TEAM_ID}&limit=50")"
  url="$(SHA="$SHA" python3 -c '
import json, os, sys
sha = os.environ["SHA"]
data = json.load(sys.stdin)
for d in data.get("deployments") or []:
    meta = d.get("meta") or {}
    commit = meta.get("githubCommitSha") or meta.get("gitCommitSha") or ""
    if commit != sha or d.get("target") == "production":
        continue
    if d.get("state") == "READY" and d.get("url"):
        print(d["url"])
        break
' <<<"$json")"
  if [ -n "$url" ]; then
    break
  fi
  echo "Not ready yet; sleeping 20s"
  sleep 20
done

if [ -z "$url" ]; then
  echo "No READY preview deployment for ${SHA}. Push the same commit to preview first, wait for Vercel, then retag." >&2
  exit 1
fi

echo "Promoting https://${url}"
npx --yes vercel@59.1.3 promote "https://${url}" --scope "${SCOPE}" --yes --token "${TOKEN}"
