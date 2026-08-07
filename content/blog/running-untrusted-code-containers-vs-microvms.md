---
title: 'Running untrusted code: containers versus microVMs'
description: A container shares the host kernel, so a kernel bug is a host compromise. A microVM does not. Here is what changed when BlankCode moved submission execution from Docker to Firecracker, and what it cost in latency.
date: '2026-08-06'
author: BlankCode
tags:
  - security
  - sandboxing
  - infrastructure
---

Any product that runs code its users wrote has the same problem at the centre of
it: you are executing a stranger's program on your machine, and the only thing
between that program and everything else you own is your sandbox.

BlankCode runs submissions in six languages. This is how the sandbox works, why
it changed, and what the change actually cost.

## What a hardened container gives you

The first implementation used Docker, locked down about as far as Docker goes:

```
--network none          # no egress, no lateral movement
--read-only             # immutable root filesystem
--cap-drop ALL          # no capabilities at all
--pids-limit            # no fork bombs
--memory / --cpus       # no resource exhaustion
--security-opt no-new-privileges
```

That is a genuinely useful boundary and it stops the overwhelming majority of
what a submission could try. Untrusted code cannot reach the network, cannot
write outside its workspace, cannot escalate privileges, and cannot starve the
host of CPU or memory.

What it does not change is the shape of the boundary. Containers are a kernel
feature — namespaces and cgroups — and every container on a host shares that
host's kernel. The isolation is enforced *by* the thing that is also being
attacked. A sufficiently interesting kernel bug reachable through a syscall is
not a container escape in the abstract; it is a host compromise, and the list of
CVEs in that category is not short.

You can narrow the syscall surface with seccomp profiles and it is worth doing.
But you are reducing the size of the attack surface, not changing what is on the
other side of it.

## What a microVM changes

A Vercel Sandbox run is a Firecracker microVM. Each submission gets its own
kernel, its own virtual hardware, and a hypervisor boundary between it and the
host. The syscalls a submission makes are handled by a kernel that exists only
for that submission and is destroyed with it.

The practical difference is what a kernel bug buys an attacker. In the container
model, a kernel exploit reaches the host. In the microVM model, it reaches a
kernel that was created for this run and has nothing else in it. Getting to the
host requires a hypervisor escape, which is a much smaller and much more
carefully audited surface — Firecracker exists precisely because AWS wanted that
surface minimal for Lambda.

This is the uncomfortable part of the comparison for anyone who has spent years
hardening containers: the microVM is not "Docker with extra flags." It is a
different class of boundary, and the flags were never going to get you there.

## The part everyone assumes is the catch

The received wisdom is that VMs are slow to start and containers are fast, so
stronger isolation costs you latency. For this workload that turned out not to
be true, but only after fixing the things that actually cost time.

Two decisions did the work.

**Snapshots.** A submission does not need a general-purpose machine, it needs a
machine with one toolchain on it. Each language gets a snapshot with the
compiler, the test runner, and warm build caches already baked in — for Rust,
that means the crate registry vendored to disk and a prebuilt target directory,
so `cargo test --offline` never touches the network or compiles a dependency.
Booting from a snapshot skips all of that.

**No persistence.** A sandbox can snapshot its filesystem when it stops, which
is useful for long-lived environments and pure overhead here. A submission is
throwaway: the verdict is the only thing anybody reads, and it is already in
hand. Turning persistence off removed five to seven seconds per run.

Measured end to end against the real exercise corpus — create the sandbox, write
the files, compile, run the tests, parse the output — all six language tracks
land between 2.0 and 12.4 seconds, with Python at the fast end and Rust at the
slow one. That is at least as fast as the container path it replaced.

## Three bugs that only showed up when it ran

The wiring looked correct long before it worked. Every one of these was found by
running the actual corpus and reading the failures, not by reviewing the code.

**Nothing was on `PATH`.** The snapshot moved `node_modules` to `/` but never
linked `/node_modules/.bin`, and `runCommand` is not a login shell, so nothing
in a shell profile applies. Five of six tracks died with `vitest: command not
found`. The fix is to symlink the binaries into `/usr/local/bin` at snapshot
build time — including `$HOME/.cargo/bin`, which has the same problem.

**The warmup files were still there.** Building the snapshot involves compiling
a small program to warm the caches. That program was left on disk, so when a Go
submission arrived, the package directory contained two `main` functions and the
compiler refused. Snapshot builds now delete their warmup files before
snapshotting.

**Rust could not link.** `rustup` installs a toolchain but not a C linker, so
`cargo` failed with ``linker `cc` not found``. Installing `gcc` fixed it, which
is obvious in retrospect and invisible until you try.

The pattern in all three is the same: the failure was in the environment, not
the logic, and no amount of reading the code would have surfaced it.

## What this means if you are building something similar

If you run untrusted code and you are on containers, hardened containers are a
real boundary and far better than nothing — keep the flags. But be honest in
your threat model about what a shared kernel means, and do not describe it as
isolation equivalent to a VM, because it is not.

If a microVM sandbox is available to you, the interesting finding is that the
latency argument against it mostly evaporates once you snapshot the toolchain
and stop persisting state nobody reads. The cost was not the hypervisor. It was
installing a compiler on every run.
