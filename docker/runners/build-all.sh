#!/bin/sh
# Builds all language runner images. Invoked once at `docker compose up`
# by the `runner-images` one-shot service before the worker boots.
set -eu

cd "$(dirname "$0")"

LANGUAGES="typescript python react vue go rust"

for lang in $LANGUAGES; do
  echo "==> Building blankcode/runner-${lang}:latest"
  docker build \
    --quiet \
    -f "Dockerfile.${lang}" \
    -t "blankcode/runner-${lang}:latest" \
    .
done

echo "==> All runner images built:"
docker image ls --filter "reference=blankcode/runner-*"
