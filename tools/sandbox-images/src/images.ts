/**
 * Toolchain definitions for the per-language Vercel Sandbox snapshots.
 *
 * This is the serverless counterpart of `docker/runners/Dockerfile.*`. A
 * snapshot is built once and reused by every submission, exactly as a runner
 * image is — the difference is that the setup steps below run inside a
 * Firecracker microVM rather than a container build.
 *
 * Measured cold setup costs that these snapshots exist to eliminate:
 *   python  ~2s   (pip install pytest)
 *   node    ~9s   (npm install vitest)
 *   rust   ~35s   (dnf gcc + rustup)
 *   go     ~25s   (dnf golang) plus ~9s for the first cold compile
 */

export type SandboxRuntime = 'node24' | 'python3.13'

export interface SandboxImage {
  /** Language key, matching `ExecutionContext.language`. */
  language: string
  runtime: SandboxRuntime
  /** Commands that install the toolchain. Run in order. */
  setup: Array<{ cmd: string; args: string[] }>
  /**
   * A trivial project compiled during the build so the snapshot carries warm
   * caches. Go's first `go test` alone cost 9s without this.
   */
  warmup?: {
    files: Record<string, string>
    command: { cmd: string; args: string[] }
  }
}

const NODE_DEPS = ['vitest', 'typescript', '@types/node']
const REACT_DEPS = [
  'react',
  'react-dom',
  '@types/react',
  '@types/react-dom',
  '@testing-library/react',
  '@testing-library/jest-dom',
  '@testing-library/user-event',
  'react-router-dom',
  'jsdom',
]
const VUE_DEPS = [
  'vue',
  '@vue/test-utils',
  '@vue/compiler-sfc',
  '@vitejs/plugin-vue',
  'pinia',
  'jsdom',
]

function npmInstall(packages: string[]) {
  return {
    cmd: 'sh',
    args: [
      '-c',
      // Installed at / so Node's resolution from the working directory walks up
      // and finds them — the same trick the Docker runner images use.
      [
        'mkdir -p /tmp/deps && cd /tmp/deps',
        'npm init -y >/dev/null 2>&1',
        `npm install --no-audit --no-fund ${packages.join(' ')}`,
        'sudo mv /tmp/deps/node_modules /node_modules',
        // `runCommand` is not a login shell, so exporting PATH would be lost.
        // Symlinking into /usr/local/bin is what actually makes `vitest` and
        // `tsc` resolvable from the executor's commands.
        'sudo ln -sf /node_modules/.bin/* /usr/local/bin/',
      ].join(' && '),
    ],
  }
}

export const SANDBOX_IMAGES: SandboxImage[] = [
  {
    language: 'typescript',
    runtime: 'node24',
    setup: [npmInstall(NODE_DEPS)],
  },
  {
    language: 'react',
    runtime: 'node24',
    setup: [npmInstall([...NODE_DEPS, ...REACT_DEPS])],
  },
  {
    language: 'vue',
    runtime: 'node24',
    setup: [npmInstall([...NODE_DEPS, ...VUE_DEPS])],
  },
  {
    language: 'python',
    runtime: 'python3.13',
    setup: [{ cmd: 'sh', args: ['-c', 'pip3 install --quiet pytest'] }],
  },
  {
    language: 'go',
    runtime: 'node24',
    setup: [{ cmd: 'sudo', args: ['dnf', 'install', '-y', '-q', 'golang'] }],
    warmup: {
      files: {
        'go.mod': 'module warmup\n\ngo 1.21\n',
        'warmup.go': 'package warmup\n\nfunc Add(a, b int) int { return a + b }\n',
        'warmup_test.go':
          'package warmup\n\nimport "testing"\n\nfunc TestAdd(t *testing.T) {\n\tif Add(1,1) != 2 { t.Fatal("bad") }\n}\n',
      },
      command: { cmd: 'go', args: ['test', './...'] },
    },
  },
  {
    language: 'rust',
    runtime: 'node24',
    setup: [
      // rustup alone is not enough — cargo shells out to `cc` to link, and
      // without gcc every build dies with "linker `cc` not found".
      { cmd: 'sudo', args: ['dnf', 'install', '-y', '-q', 'gcc'] },
      {
        cmd: 'sh',
        args: [
          '-c',
          [
            "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain stable",
            'sudo ln -sf "$HOME/.cargo/bin/"* /usr/local/bin/',
          ].join(' && '),
        ],
      },
    ],
    warmup: {
      /*
       * The Rust executor runs `cargo test --offline` against crates vendored
       * into /opt/blankcode/vendor — a Docker-image path that a snapshot does
       * not inherit. Without this, any exercise using tokio fails with
       * "failed to get `tokio` as a dependency". Keep the dependency list in
       * step with VENDORED_CRATES in rust.executor.ts.
       */
      files: {
        'Cargo.toml': [
          '[package]',
          'name = "warmup"',
          'version = "0.1.0"',
          'edition = "2021"',
          '',
          '[dependencies]',
          'tokio = { version = "1", features = ["macros", "rt", "rt-multi-thread", "sync", "time"] }',
          'serde = { version = "1", features = ["derive"] }',
          'serde_json = "1"',
        ].join('\n'),
        'src/lib.rs': [
          '#[derive(serde::Serialize, serde::Deserialize)]',
          'pub struct Warm { pub a: i32 }',
          '',
          'pub fn add(a: i32, b: i32) -> i32 { a + b }',
          '',
          '#[cfg(test)]',
          'mod t {',
          '  use super::*;',
          '  #[test] fn w() { assert_eq!(add(1,1), 2); }',
          // Referencing each crate is what gets it compiled into the prebuilt
          // target, so a submission using it does not pay for the build.
          '  #[test] fn s() { let j = serde_json::to_string(&Warm { a: 1 }).unwrap(); assert_eq!(j, "{\\"a\\":1}"); }',
          '}',
        ].join('\n'),
      },
      command: {
        cmd: 'sh',
        args: [
          '-c',
          [
            // Fetch and vendor to the same paths the Docker image uses, so the
            // executor's --offline build resolves identically in both backends.
            'cargo fetch',
            'sudo mkdir -p /opt/blankcode',
            'sudo chown -R "$(id -u):$(id -g)" /opt/blankcode',
            'cargo vendor --versioned-dirs /opt/blankcode/vendor > /tmp/vendor-config.toml',
            'cargo test --no-run',
            'mkdir -p /opt/blankcode/prebuilt',
            'cp -a target /opt/blankcode/prebuilt/target',
          ].join(' && '),
        ],
      },
    },
  },
]

/** Env var the API reads to find a language's snapshot. */
export function snapshotEnvVar(language: string): string {
  return `SANDBOX_SNAPSHOT_${language.toUpperCase()}`
}
