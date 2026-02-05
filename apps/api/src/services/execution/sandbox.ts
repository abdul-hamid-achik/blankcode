import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { config } from '../../config/index.js'
import type { ExecutionContext } from './types.js'

// Use configurable workspace path for docker-in-docker compatibility
// This path must be accessible from both the worker container and the host
function getWorkspaceBasePath(): string {
  return process.env['EXECUTION_WORKSPACE_PATH'] || join(tmpdir(), 'blankcode-exec')
}

interface SandboxOptions {
  image: string
  command: string[]
  workDir: string
  timeoutMs: number
  memoryLimitMb: number
  cpuLimit: number
}

export async function runInSandbox(
  options: SandboxOptions
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const { image, command, workDir, timeoutMs, memoryLimitMb, cpuLimit } = options

  const dockerArgs = [
    'run',
    '--rm',
    '--network=none',
    `--memory=${memoryLimitMb}m`,
    `--cpus=${cpuLimit}`,
    '--pids-limit=50',
    '--security-opt=no-new-privileges',
    '-v',
    `${workDir}:/app:rw`,
    '-w',
    '/app',
    image,
    ...command,
  ]

  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let killed = false

    const proc = spawn('docker', dockerArgs, {
      timeout: timeoutMs,
    })

    const timer = setTimeout(() => {
      killed = true
      proc.kill('SIGKILL')
    }, timeoutMs)

    proc.stdout.on('data', (data) => {
      stdout += data.toString()
      if (stdout.length > 1024 * 1024) {
        killed = true
        proc.kill('SIGKILL')
      }
    })

    proc.stderr.on('data', (data) => {
      stderr += data.toString()
      if (stderr.length > 1024 * 1024) {
        killed = true
        proc.kill('SIGKILL')
      }
    })

    proc.on('error', (err) => {
      clearTimeout(timer)
      resolve({
        stdout,
        stderr: `${stderr}\n${err.message}`,
        exitCode: 1,
      })
    })

    proc.on('close', (code) => {
      clearTimeout(timer)
      if (killed) {
        resolve({
          stdout,
          stderr: `${stderr}\nExecution timeout or resource limit exceeded`,
          exitCode: 124,
        })
      } else {
        resolve({
          stdout,
          stderr,
          exitCode: code ?? 1,
        })
      }
    })
  })
}

export async function prepareWorkspace(files: Record<string, string>): Promise<string> {
  const workDir = join(getWorkspaceBasePath(), randomUUID())
  await mkdir(workDir, { recursive: true })
  await mkdir(join(workDir, 'tmp'), { recursive: true })

  for (const [filename, content] of Object.entries(files)) {
    const filePath = join(workDir, filename)
    const dir = join(workDir, ...filename.split('/').slice(0, -1))
    if (dir !== workDir) {
      await mkdir(dir, { recursive: true })
    }
    await writeFile(filePath, content, 'utf-8')
  }

  return workDir
}

export async function cleanupWorkspace(workDir: string): Promise<void> {
  try {
    await rm(workDir, { recursive: true, force: true })
  } catch {
    // Ignore cleanup errors
  }
}

export async function executeInDocker(
  context: ExecutionContext,
  files: Record<string, string>,
  command: string[]
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const image = config.execution.images[context.language] ?? config.execution.images['typescript']!

  const workDir = await prepareWorkspace(files)

  try {
    const result = await runInSandbox({
      image,
      command,
      workDir,
      timeoutMs: context.timeoutMs,
      memoryLimitMb: context.memoryLimitMb,
      cpuLimit: config.execution.cpuLimit,
    })

    return result
  } finally {
    await cleanupWorkspace(workDir)
  }
}

const SAFE_ENV_KEYS = [
  'PATH',
  'HOME',
  'SHELL',
  'USER',
  'LANG',
  'LC_ALL',
  'TMPDIR',
  'GOPATH',
  'GOROOT',
  'CARGO_HOME',
  'RUSTUP_HOME',
]

export async function executeLocally(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let killed = false

    const safeEnv: Record<string, string> = { NODE_ENV: 'test' }
    for (const key of SAFE_ENV_KEYS) {
      if (process.env[key]) {
        safeEnv[key] = process.env[key]!
      }
    }

    const proc = spawn(command, args, {
      cwd,
      timeout: timeoutMs,
      env: safeEnv,
    })

    const timer = setTimeout(() => {
      killed = true
      proc.kill('SIGKILL')
    }, timeoutMs)

    proc.stdout.on('data', (data) => {
      stdout += data.toString()
      if (stdout.length > 1024 * 1024) {
        killed = true
        proc.kill('SIGKILL')
      }
    })

    proc.stderr.on('data', (data) => {
      stderr += data.toString()
      if (stderr.length > 1024 * 1024) {
        killed = true
        proc.kill('SIGKILL')
      }
    })

    proc.on('error', (err) => {
      clearTimeout(timer)
      resolve({
        stdout,
        stderr: `${stderr}\n${err.message}`,
        exitCode: 1,
      })
    })

    proc.on('close', (code) => {
      clearTimeout(timer)
      if (killed) {
        resolve({
          stdout,
          stderr: `${stderr}\nExecution timeout`,
          exitCode: 124,
        })
      } else {
        resolve({
          stdout,
          stderr,
          exitCode: code ?? 1,
        })
      }
    })
  })
}
