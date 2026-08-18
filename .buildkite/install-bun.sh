#!/usr/bin/env bash
# Pin bun to BUN_VERSION and Node to NODE_VERSION. Hosted Linux currently
# ships Node 20.18, which cannot load node:sqlite (Nuxt Content) and cannot
# require Vite's ESM config. Do not install better-sqlite3 to paper over that.
set -euo pipefail
: "${BUN_VERSION:?set BUN_VERSION in the pipeline env to match packageManager}"
NODE_VERSION="${NODE_VERSION:-24.19.0}"

export BUN_INSTALL="${BUN_INSTALL:-${HOME}/.bun}"
export BUN_CONFIG_HTTP_IDLE_TIMEOUT="${BUN_CONFIG_HTTP_IDLE_TIMEOUT:-30}"

case "$(uname -m)" in
  x86_64 | amd64) NODE_ARCH=linux-x64 ;;
  aarch64 | arm64) NODE_ARCH=linux-arm64 ;;
  *)
    echo "unsupported arch $(uname -m)" >&2
    exit 1
    ;;
esac

NODE_PREFIX="${HOME}/.local/node-v${NODE_VERSION}"
if [ ! -x "${NODE_PREFIX}/bin/node" ]; then
  mkdir -p "${HOME}/.local"
  curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-${NODE_ARCH}.tar.xz" |
    tar -xJ -C "${HOME}/.local"
  mv "${HOME}/.local/node-v${NODE_VERSION}-${NODE_ARCH}" "${NODE_PREFIX}"
fi

if ! command -v bun >/dev/null 2>&1 || [ "$(bun --version)" != "${BUN_VERSION}" ]; then
  curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}"
fi

export PATH="${NODE_PREFIX}/bin:${BUN_INSTALL}/bin:${PATH}"
node --version
bun --version
