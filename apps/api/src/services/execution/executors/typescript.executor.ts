import { config } from '../../../config/index.js'
import { logger } from '../logger.js'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseVitestOutput } from '../parsers/vitest.parser.js'
import { cleanupWorkspace, executeInDocker, executeLocally, prepareWorkspace } from '../sandbox.js'
import type { ExecutionContext, ExecutionResult, LanguageExecutor } from '../types.js'

const SFC_BLOCK_RE = /^[ \t]*<(?:template|script|style)[\s>]/m

/**
 * A Vue exercise is either a single-file component or a plain module
 * (composable / Pinia store). The two need different file extensions, a
 * different module specifier and different tooling, so the shape is read off
 * the solution itself rather than guessed from the concept name.
 */
export function isVueSingleFileComponent(solutionCode: string): boolean {
  return SFC_BLOCK_RE.test(solutionCode)
}

/**
 * Vue tests import author-invented paths — './use-counter', './todo-store',
 * './button.vue' — none of which exist in the sandbox. Every *relative*
 * specifier is the student's solution under a different name; bare specifiers
 * ('vue', 'pinia', '@vue/test-utils') resolve to real packages and must be
 * left alone.
 */
export function rewriteVueTestImports(testCode: string, isSfc: boolean): string {
  const solutionModule = isSfc ? './solution.vue' : './solution'
  let rewritten = testCode

  if (isSfc) {
    // An SFC's only export is the component, as the default. Tests routinely
    // spell it as a named import (`import { Button } from './button.vue'`),
    // which resolves to undefined and makes every `mount()` throw. A lone
    // named specifier on a relative path can only mean the component.
    rewritten = rewritten.replace(
      /import\s*\{\s*([A-Za-z_$][\w$]*)\s*\}\s*from\s*(['"])\.{1,2}\/[^'"]*\2/g,
      `import $1 from '${solutionModule}'`
    )
  }

  rewritten = rewritten
    .replace(/from\s*(['"])\.{1,2}\/[^'"]*\1/g, `from '${solutionModule}'`)
    .replace(
      /(\bimport\s*\(|\bvi\.mock\s*\(|\brequire\s*\()\s*(['"])\.{1,2}\/[^'"]*\2/g,
      `$1'${solutionModule}'`
    )

  // A test that reaches for the solution's exports as globals still needs them
  // in scope. Meaningless for an SFC, whose export is a component.
  if (!isSfc && !rewritten.includes(solutionModule)) {
    rewritten = `import * as solution from '${solutionModule}';\nObject.assign(globalThis, solution);\n\n${rewritten}`
  }

  return rewritten
}

/**
 * Removes the bindings a test imports that the solution has already imported
 * from the same module, so concatenating the two for the typecheck gate does
 * not redeclare them.
 *
 * Only the duplicated *bindings* are dropped, never the whole statement. A test
 * that imports `{ nextTick }` from 'vue' while the solution imports `{ ref }`
 * shares a module but not a name, and deleting its import line left `nextTick`
 * undefined — which looked like a mistake in the exercise rather than in here.
 */
function dedupeImportsAgainst(testCode: string, solutionCode: string): string {
  const IMPORT = /^\s*import\s+([^;\n]*?)\s+from\s*['"]([^'"]+)['"]\s*;?[ \t]*\n?/gm

  /** Named bindings the solution already brings in, per module. */
  const taken = new Map<string, Set<string>>()
  const namesOf = (clause: string): string[] => {
    const braces = /\{([^}]*)\}/.exec(clause)
    if (!braces?.[1]) return []
    return braces[1]
      .split(',')
      .map(
        (part) =>
          part
            .replace(/^\s*type\s+/, '')
            .split(/\sas\s/)[0]
            ?.trim() ?? ''
      )
      .filter(Boolean)
  }

  for (const match of solutionCode.matchAll(IMPORT)) {
    const [, clause = '', specifier = ''] = match
    const names = taken.get(specifier) ?? new Set<string>()
    for (const name of namesOf(clause)) names.add(name)
    taken.set(specifier, names)
  }
  if (taken.size === 0) return testCode

  return testCode.replace(IMPORT, (line, clause: string, specifier: string) => {
    const already = taken.get(specifier)
    if (!already) return line

    const braces = /\{([^}]*)\}/.exec(clause)
    // A default or namespace import shares no name with a named one, and the
    // solution's default is the thing under test — drop it either way.
    if (!braces) return ''

    const kept = braces[1]!
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .filter((part) => {
        const name =
          part
            .replace(/^type\s+/, '')
            .split(/\sas\s/)[0]
            ?.trim() ?? ''
        return !already.has(name)
      })

    if (kept.length === 0) return ''
    return `import { ${kept.join(', ')} } from '${specifier}'\n`
  })
}

export class TypeScriptExecutor implements LanguageExecutor {
  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now()
    const isReact = context.language === 'react'
    const isVue = context.language === 'vue'
    const isVueSfc = isVue && isVueSingleFileComponent(context.code)

    // The solution's extension follows the exercise; the test file is always
    // TypeScript (a `.vue` test file would be compiled as a component).
    const ext = isReact ? '.tsx' : '.ts'
    const solutionExt = isReact ? '.tsx' : isVueSfc ? '.vue' : '.ts'

    // Auto-export top-level declarations from solution.
    // Uses negative lookahead to avoid double-exporting already-exported symbols.
    // An SFC is skipped entirely: `export` is illegal inside `<script setup>`,
    // and its public surface is the default export the compiler generates.
    let solutionCode = context.code
    if (!isVueSfc) {
      // Export function declarations (including async functions)
      solutionCode = solutionCode.replace(
        /^(?!export\s)((?:async\s+)?function\s+\w+)/gm,
        'export $1'
      )
      // Export const/let declarations
      solutionCode = solutionCode.replace(/^(?!export\s)((?:const|let)\s+\w+\s*=)/gm, 'export $1')
      // Export class declarations
      solutionCode = solutionCode.replace(/^(?!export\s)(class\s+\w+)/gm, 'export $1')
    }

    // Process test code:
    // 1. Remove vitest imports (we use --globals flag)
    // 2. Auto-import from solution if not already imported
    let testCode = context.testCode
      .replace(/import\s*\{[^}]*\}\s*from\s*['"]vitest['"]\s*;?\n?/g, '')
      .replace(/import\s+.*\s+from\s*['"]vitest['"]\s*;?\n?/g, '')

    if (isReact) {
      // Rewrite component imports like from './Counter' to from './solution'
      testCode = testCode.replace(/from\s+['"]\.\/(?!solution)[^'"]+['"]/g, "from './solution'")
    } else if (isVue) {
      testCode = rewriteVueTestImports(testCode, isVueSfc)
    } else {
      if (!testCode.includes("from './solution'") && !testCode.includes('from "./solution"')) {
        testCode = `import * as solution from './solution';\nObject.assign(globalThis, solution);\n\n${testCode}`
      }
    }

    const tsconfigOptions = {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      ...(isReact ? { jsx: 'react-jsx' as const } : {}),
    }

    /*
     * TypeScript types are erased before vitest ever runs, so a type-level
     * blank (`id: ___`) cannot be verified by executing the tests — writing
     * `string` where `number` belongs still passes every assertion. Almost
     * every blank in the TypeScript track is type-level, which made most of
     * the track unverifiable.
     *
     * Compiling the solution and the test as ONE module puts the solution's
     * declarations in the test's scope, so `tsc --noEmit` catches the
     * mismatch the runtime never could.
     */
    // An SFC cannot be fed to `tsc` — the file is not TypeScript — so the
    // single-module typecheck only applies to plain modules.
    const typecheckSource = isVueSfc
      ? null
      : [
          // The React runs load jest-dom through `setup.ts` at *runtime*; the
          // typecheck compiles a standalone file, so without this import every
          // `expect(...).toBeInTheDocument()` in the corpus is a type error and
          // the gate rejects the canonical solution.
          ...(isReact ? [`import '@testing-library/jest-dom'`] : []),
          `import { describe, expect, test, it, beforeEach, afterEach, vi } from 'vitest'`,
          `void [describe, expect, test, it, beforeEach, afterEach, vi]`,
          context.code,
          // Merging two modules means the same bare import can appear twice
          // (`import { BrowserRouter } from 'react-router-dom'` in both the
          // solution and the test), which is a duplicate-identifier error. Drop
          // any test-side import the solution already made.
          dedupeImportsAgainst(
            context.testCode
              .replace(/import\s*\{[^}]*\}\s*from\s*['"]vitest['"]\s*;?\n?/g, '')
              .replace(/import\s+.*\s+from\s*['"]vitest['"]\s*;?\n?/g, '')
              .replace(/import\s+.*\s+from\s*['"]\.{1,2}\/[^'"]+['"]\s*;?\n?/g, ''),
            context.code
          ),
        ].join('\n')

    // Common files for both Docker and local execution
    const baseFiles: Record<string, string> = {
      [`solution${solutionExt}`]: solutionCode,
      [`solution.test${ext}`]: testCode,
      'tsconfig.json': JSON.stringify({ compilerOptions: tsconfigOptions }),
    }
    if (typecheckSource !== null) {
      baseFiles[`__typecheck${ext}`] = typecheckSource
      /*
       * Naming a file on the tsc command line disables tsconfig discovery, so
       * `tsc --noEmit __typecheck.ts` silently compiles at the ES5 default lib
       * with no skipLibCheck — which failed every TypeScript submission on
       * vitest's own .d.ts before its tests ever ran. The gate must be invoked
       * as `tsc -p tsconfig.typecheck.json`.
       *
       * `types: ['node']` is required because tests reach for `global`, and the
       * DOM lib because React/Vue tests touch `document` and `localStorage`.
       */
      baseFiles['tsconfig.typecheck.json'] = JSON.stringify({
        compilerOptions: {
          ...tsconfigOptions,
          lib: ['ES2022', 'DOM', 'DOM.Iterable'],
          types: ['node'],
          noEmit: true,
        },
        files: [`__typecheck${ext}`],
      })
    }

    if (isReact) {
      baseFiles['setup.ts'] = `import '@testing-library/jest-dom';\n`
      baseFiles['vitest.config.ts'] = [
        `import { defineConfig } from 'vitest/config';`,
        `export default defineConfig({`,
        `  test: {`,
        `    globals: true,`,
        `    environment: 'jsdom',`,
        `    setupFiles: ['./setup.ts'],`,
        `  },`,
        `});`,
      ].join('\n')
    }

    if (isVue) {
      /*
       * `@vitejs/plugin-vue` is what compiles `<template>`/`<script setup>`; the
       * `vue` alias points at the full ESM bundler build so a test that mounts
       * an inline `template:` string still has the runtime compiler. jsdom is
       * required by every `mount()` and by composables touching `localStorage`.
       */
      baseFiles['vitest.config.ts'] = vueVitestConfig()
    }

    try {
      let stdout: string
      let stderr: string
      let exitCode: number

      if (config.execution.dockerEnabled) {
        const vitestArgs =
          isReact || isVue
            ? `vitest run --reporter=json --config vitest.config.ts solution.test${ext}`
            : `vitest run --reporter=json --globals solution.test${ext}`

        /*
         * The typecheck must run INSIDE the container, not just on the local
         * path — Docker is the production configuration, and for a while the
         * gate lived only in the `else` branch below. The consequence was that
         * every type-level blank in the TypeScript track was unverifiable in
         * production: a submission with deliberately wrong types came back
         * `passed`. Chained with `&&` so a type error short-circuits before
         * vitest runs and its output is what the user sees.
         */
        const command =
          typecheckSource !== null
            ? ['sh', '-c', `tsc --noEmit -p tsconfig.typecheck.json && ${vitestArgs}`]
            : ['sh', '-c', vitestArgs]

        const result = await executeInDocker(context, baseFiles, command)
        stdout = result.stdout
        stderr = result.stderr
        exitCode = result.exitCode

        // `tsc` reports to stdout. If it failed, the run never reached vitest,
        // so there is no JSON to parse — surface the compiler errors instead of
        // the generic "no results" message.
        if (exitCode !== 0 && /error TS\d+/.test(`${stdout}\n${stderr}`)) {
          return {
            success: false,
            status: 'failed',
            testResults: [],
            executionTimeMs: Date.now() - startTime,
            errorMessage: `${stdout}\n${stderr}`.trim().slice(0, 2000),
          }
        }
      } else {
        // Local: Need package.json and vitest config for npm install
        const localDeps: Record<string, string> = {
          vitest: '^2.0.0',
          typescript: '^5.0.0',
        }
        if (isReact) {
          Object.assign(localDeps, {
            react: '^18.0.0',
            'react-dom': '^18.0.0',
            '@types/react': '^18.0.0',
            '@types/react-dom': '^18.0.0',
            '@testing-library/react': '^14.0.0',
            '@testing-library/jest-dom': '^6.0.0',
            // Kept in step with docker/runners/Dockerfile.react — the routing
            // exercises import both, and a dependency the image has but the
            // local path does not makes the same submission pass in production
            // and fail in development.
            '@testing-library/user-event': '^14.0.0',
            'react-router-dom': '^6.0.0',
            jsdom: '^24.0.0',
          })
        }
        if (isVue) {
          Object.assign(localDeps, {
            vue: '^3.4.0',
            '@vue/test-utils': '^2.4.0',
            '@vue/compiler-sfc': '^3.4.0',
            '@vitejs/plugin-vue': '^5.0.0',
            pinia: '^2.1.0',
            jsdom: '^24.0.0',
          })
        }

        const localFiles: Record<string, string> = {
          ...baseFiles,
          'package.json': JSON.stringify({
            name: 'test-runner',
            type: 'module',
            scripts: {
              test:
                isReact || isVue
                  ? `vitest run --reporter=json --config vitest.config.ts`
                  : 'vitest run --reporter=json',
            },
            devDependencies: localDeps,
          }),
        }

        if (typecheckSource !== null) {
          // `tsc --noEmit <file>` IGNORES tsconfig.json entirely (documented
          // tsc behaviour: an explicit file list disables config discovery), so
          // the check ran with the ES5 default lib and no `skipLibCheck` and
          // failed on every single submission — `ReadonlySet` missing from
          // @vitest/expect's .d.ts. The options have to arrive via `-p`, and
          // the project has to name exactly one file so `solution.test.ts` is
          // not compiled again standalone (its vitest globals are injected).
          localFiles['tsconfig.typecheck.json'] = JSON.stringify({
            compilerOptions: tsconfigOptions,
            files: [`__typecheck${ext}`],
          })
        }

        if (isVue) {
          // Same config as Docker, plus the file-based JSON report the local
          // path reads back (stdout only carries the run banner).
          localFiles['vitest.config.ts'] = vueVitestConfig({
            reportTo: './results.json',
          })
        } else if (isReact) {
          // Override the base React vitest config with local-specific settings
          localFiles['vitest.config.ts'] = [
            `import { defineConfig } from 'vitest/config';`,
            `export default defineConfig({`,
            `  test: {`,
            `    include: ['*.test.tsx'],`,
            `    globals: true,`,
            `    environment: 'jsdom',`,
            `    setupFiles: ['./setup.ts'],`,
            `    reporters: ['json'],`,
            `    outputFile: './results.json',`,
            `  },`,
            `});`,
          ].join('\n')
        } else {
          localFiles['vitest.config.ts'] = `
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['*.test.ts'],
    globals: true,
    reporters: ['json'],
    outputFile: './results.json',
  },
})
`
        }

        const workDir = await prepareWorkspace(localFiles)
        try {
          // Install dependencies
          const installResult = await executeLocally('npm', ['install', '--silent'], workDir, 60000)
          if (installResult.exitCode !== 0) {
            return {
              success: false,
              status: 'error',
              testResults: [],
              executionTimeMs: Date.now() - startTime,
              errorMessage: `Failed to install dependencies: ${installResult.stderr}`,
            }
          }

          // Typecheck first: a type-level blank can only fail here.
          // Skipped for SFCs, which `tsc` cannot parse.
          if (typecheckSource !== null) {
            const typecheck = await executeLocally(
              'npx',
              ['tsc', '--noEmit', '-p', 'tsconfig.typecheck.json'],
              workDir,
              60000
            )
            if (typecheck.exitCode !== 0) {
              return {
                success: false,
                status: 'failed',
                testResults: [],
                executionTimeMs: Date.now() - startTime,
                errorMessage: `${typecheck.stdout}\n${typecheck.stderr}`.trim().slice(0, 2000),
              }
            }
          }

          // Run tests
          const testResult = await executeLocally('npm', ['test'], workDir, context.timeoutMs)
          stdout = testResult.stdout
          stderr = testResult.stderr
          exitCode = testResult.exitCode

          // The generated vitest config sets `outputFile: './results.json'`, so
          // the JSON reporter writes to disk and stdout carries only the run
          // banner. Reading stdout alone parsed zero tests on every local run.
          try {
            const report = await readFile(join(workDir, 'results.json'), 'utf-8')
            if (report.trim()) stdout = `${stdout}\n${report}`
          } catch {
            // No report file — fall through and parse whatever stdout has.
          }
        } finally {
          try {
            await cleanupWorkspace(workDir)
          } catch (cleanupError) {
            logger.warn('Failed to clean up workspace', { workDir, error: String(cleanupError) })
          }
        }
      }

      const executionTimeMs = Date.now() - startTime
      const output = `${stdout}\n${stderr}`

      if (exitCode === 124) {
        return {
          success: false,
          status: 'error',
          testResults: [],
          executionTimeMs,
          errorMessage: 'Execution timeout exceeded',
        }
      }

      const testResults = parseVitestOutput(output)

      if (testResults.length === 0 && exitCode !== 0) {
        return {
          success: false,
          status: 'error',
          testResults: [],
          executionTimeMs,
          errorMessage: extractErrorMessage(output),
        }
      }

      // `[].every(...)` is true, so a run that produced no parseable results
      // would report "passed" with 0/0 tests — a false green that still marked
      // the exercise complete and advanced the SM-2 schedule. No tests is not a
      // pass; it means the suite never ran or its output could not be parsed.
      if (testResults.length === 0) {
        return {
          success: false,
          status: 'error',
          testResults: [],
          executionTimeMs,
          errorMessage:
            extractErrorMessage(output) ||
            'The test suite produced no results. The code may not compile, or the tests did not run.',
        }
      }

      const allPassed = testResults.every((r) => r.passed)

      return {
        success: allPassed,
        status: allPassed ? 'passed' : 'failed',
        testResults,
        executionTimeMs,
      }
    } catch (error) {
      return {
        success: false,
        status: 'error',
        testResults: [],
        executionTimeMs: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown execution error',
      }
    }
  }
}

/**
 * Vitest config for the Vue runner. Identical between Docker and local except
 * for the JSON report, which the local path has to read back off disk.
 */
function vueVitestConfig(options: { reportTo?: string } = {}): string {
  const reporting = options.reportTo
    ? [`    reporters: ['json'],`, `    outputFile: '${options.reportTo}',`]
    : []

  return [
    `import { defineConfig } from 'vitest/config';`,
    `import vue from '@vitejs/plugin-vue';`,
    `export default defineConfig({`,
    `  plugins: [vue()],`,
    `  resolve: {`,
    // The runtime-only build is the default resolution for `vue`; the full
    // build adds the template compiler so `mount({ template: '...' })` works.
    `    alias: { vue: 'vue/dist/vue.esm-bundler.js' },`,
    `  },`,
    `  test: {`,
    `    include: ['*.test.ts'],`,
    `    globals: true,`,
    `    environment: 'jsdom',`,
    ...reporting,
    `  },`,
    `});`,
  ].join('\n')
}

function extractErrorMessage(output: string): string {
  const errorPatterns = [
    /error TS\d+: (.+)/i,
    /SyntaxError: (.+)/i,
    /TypeError: (.+)/i,
    /ReferenceError: (.+)/i,
    /Error: (.+)/i,
  ]

  for (const pattern of errorPatterns) {
    const match = output.match(pattern)
    if (match) {
      return match[1]?.trim() ?? ''
    }
  }

  const lines = output.split('\n').filter((l) => l.trim())
  return lines.slice(-5).join('\n') || 'Unknown error'
}

export const typescriptExecutor = new TypeScriptExecutor()
