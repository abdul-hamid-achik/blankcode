FROM golang:1.22-alpine

WORKDIR /app

# Create non-root user with writable Go cache directories
RUN adduser -D -u 10000 runner && \
    mkdir -p /home/runner/go /home/runner/.cache/go-build && \
    chown -R runner:runner /home/runner

# The sandbox starts every container with `--read-only` and mounts exactly one
# writable filesystem: `--tmpfs=/tmp` (apps/api/src/services/execution/sandbox.ts).
# GOCACHE pointed inside the read-only rootfs, so `go test` died before running a
# single test with "failed to initialize build cache at
# /home/runner/.cache/go-build: read-only file system" — every Go submission
# errored in Docker mode. Both caches have to live under /tmp.
ENV HOME=/tmp
ENV GOPATH=/tmp/go
ENV GOCACHE=/tmp/go-build

# `--ulimit=fsize=10485760` (10 MB) is the second half of the same problem: with
# a cold cache the compiler rebuilds `runtime`, whose `_pkg_.a` is ~11 MB with
# debug info and trips SIGXFSZ ("compile: writing output: ... file too large").
# Dropping DWARF keeps every archive comfortably under the cap. Set through
# GOFLAGS so it applies to whatever command the executor passes.
ENV GOFLAGS="-mod=mod -gcflags=all=-dwarf=false"

USER runner

CMD ["go", "test", "-v", "./..."]
