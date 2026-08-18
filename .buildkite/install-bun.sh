#!/usr/bin/env bash
# Pin bun to BUN_VERSION (the repo's packageManager) so hosted agents don't
# float to whatever bun.sh/install currently ships.
set -euo pipefail
: "${BUN_VERSION:?set BUN_VERSION in the pipeline env to match packageManager}"
export BUN_INSTALL="${BUN_INSTALL:-${HOME}/.bun}"
export BUN_CONFIG_HTTP_IDLE_TIMEOUT="${BUN_CONFIG_HTTP_IDLE_TIMEOUT:-30}"
export PATH="${BUN_INSTALL}/bin:${PATH}"
if command -v bun >/dev/null 2>&1 && [ "$(bun --version)" = "${BUN_VERSION}" ]; then
  bun --version
  return 0 2>/dev/null || exit 0
fi
curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}"
export PATH="${BUN_INSTALL}/bin:${PATH}"
bun --version
