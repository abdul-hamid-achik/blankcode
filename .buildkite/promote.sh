#!/usr/bin/env bash
# Promote the Preview deployment for this commit to Production (no rebuild).
# Used when a v* tag is pushed. Requires Buildkite secret VERCEL_TOKEN.
#
# Origin stores the SHA as cursorOriginCommitSha. GitHub/Vercel Git use
# githubCommitSha / gitCommitSha. ignoreCommand often cancels the tagged
# SHA (changelog / AGENTS / .buildkite), so fall back to the newest READY
# preview-branch artifact rather than waiting 15 minutes to fail.
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
deployments = data.get("deployments") or []
building = {"BUILDING", "QUEUED", "INITIALIZING", "PENDING", "DEPLOYING"}

def commit_sha(meta):
    return (
        meta.get("cursorOriginCommitSha")
        or meta.get("githubCommitSha")
        or meta.get("gitCommitSha")
        or ""
    )

def ref_name(meta):
    return (
        meta.get("cursorOriginCommitRef")
        or meta.get("githubCommitRef")
        or meta.get("gitCommitRef")
        or ""
    )

def deploy_state(item):
    return item.get("readyState") or item.get("state") or ""

def is_ready_preview(item):
    if item.get("target") == "production":
        return False
    return deploy_state(item) == "READY" and bool(item.get("url"))

matched = [item for item in deployments if commit_sha(item.get("meta") or {}) == sha]
ready = [item for item in matched if is_ready_preview(item)]
if ready:
    print(ready[0]["url"])
    raise SystemExit(0)
if any(deploy_state(item) in building for item in matched):
    raise SystemExit(0)
if matched:
    for item in deployments:
        meta = item.get("meta") or {}
        if ref_name(meta) in ("main", "preview") and is_ready_preview(item):
            print(
                "SHA %s has no READY preview (latest=%s); using newest READY preview %s"
                % (sha[:7], deploy_state(matched[0]), commit_sha(meta)[:7]),
                file=sys.stderr,
            )
            print(item["url"])
            raise SystemExit(0)
' <<<"$json")"
  if [ -n "$url" ]; then
    break
  fi
  echo "Not ready yet; sleeping 20s"
  sleep 20
done

if [ -z "$url" ]; then
  echo "No READY preview deployment for ${SHA}. Push the same commit to main (or preview during cutover), wait for Vercel, then retag." >&2
  exit 1
fi

echo "Promoting https://${url}"
npx --yes vercel@59.1.3 promote "https://${url}" --scope "${SCOPE}" --yes --token "${TOKEN}"
