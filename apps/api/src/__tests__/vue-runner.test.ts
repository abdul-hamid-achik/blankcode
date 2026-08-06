import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { config } from '../config/index.js'
import {
  isVueSingleFileComponent,
  rewriteVueTestImports,
} from '../services/execution/executors/typescript.executor.js'

/**
 * The Vue track used to be unrunnable end to end: `vue` pointed at the
 * TypeScript runner image (which installs only `vitest typescript @types/node`)
 * and only the React branch rewrote the author-invented import paths that every
 * Vue test uses. Both halves are asserted here — the image/dependency wiring
 * from the files that produce it, and the source transform directly.
 */

const REPO_ROOT = join(process.cwd(), '../..')

describe('vue runner image wiring', () => {
  it('does not reuse the TypeScript image, which has no Vue dependencies', () => {
    expect(config.execution.images['vue']).toBe('blankcode/runner-vue:latest')
    expect(config.execution.images['vue']).not.toBe(config.execution.images['typescript'])
  })

  it('installs everything a Vue test can import', () => {
    const dockerfile = readFileSync(join(REPO_ROOT, 'docker/runners/Dockerfile.vue'), 'utf-8')

    for (const dep of [
      'vitest',
      'vue',
      '@vue/test-utils',
      '@vue/compiler-sfc',
      '@vitejs/plugin-vue',
      'pinia',
      'jsdom',
    ]) {
      expect(dockerfile, `Dockerfile.vue is missing ${dep}`).toMatch(
        new RegExp(`(^|\\s)${dep.replace(/[/@]/g, '\\$&')}(\\s|\\\\|$)`, 'm')
      )
    }
  })

  it('is built by the one-shot runner-images service', () => {
    const buildAll = readFileSync(join(REPO_ROOT, 'docker/runners/build-all.sh'), 'utf-8')
    expect(buildAll).toMatch(/LANGUAGES="[^"]*\bvue\b[^"]*"/)
  })

  it('is documented in .env.example so deployments can override it', () => {
    const envExample = readFileSync(join(REPO_ROOT, '.env.example'), 'utf-8')
    expect(envExample).toContain('DOCKER_IMAGE_VUE=blankcode/runner-vue:latest')
  })
})

describe('isVueSingleFileComponent', () => {
  it('detects an SFC by its block tags', () => {
    expect(isVueSingleFileComponent('<script setup lang="ts">\nconst a = 1\n</script>')).toBe(true)
    expect(isVueSingleFileComponent('<template>\n  <p>hi</p>\n</template>')).toBe(true)
  })

  it('treats a composable or store module as a plain module', () => {
    const composable =
      "import { ref } from 'vue'\nexport function useCounter() {\n  return ref(0)\n}"
    expect(isVueSingleFileComponent(composable)).toBe(false)
    // A comment claiming a `.vue` filename is not an SFC — the macros it uses
    // would be undefined at runtime, and the runner must not pretend otherwise.
    expect(isVueSingleFileComponent('// button.vue - script setup\nconst x = 1')).toBe(false)
  })
})

describe('rewriteVueTestImports', () => {
  it('points a composable import at the solution module', () => {
    const rewritten = rewriteVueTestImports(
      "import { useCounter } from './use-counter'\ntest('x', () => {})",
      false
    )
    expect(rewritten).toContain("import { useCounter } from './solution'")
    expect(rewritten).not.toContain('use-counter')
  })

  it('points an SFC import at solution.vue, which Vite cannot infer', () => {
    const rewritten = rewriteVueTestImports("import Button from './button.vue'", true)
    expect(rewritten).toContain("import Button from './solution.vue'")
  })

  it('turns a named SFC import into a default import', () => {
    // `import { Button } from './button.vue'` resolves to undefined, because an
    // SFC only ever has a default export.
    const rewritten = rewriteVueTestImports(
      "import { DebouncedSearch } from './DebouncedSearch'",
      true
    )
    expect(rewritten).toContain("import DebouncedSearch from './solution.vue'")
  })

  it('leaves package imports alone', () => {
    const source = [
      "import { mount } from '@vue/test-utils'",
      "import { nextTick } from 'vue'",
      "import { createPinia, setActivePinia } from 'pinia'",
      "import { useTodoStore } from './todo-store'",
    ].join('\n')
    const rewritten = rewriteVueTestImports(source, false)

    expect(rewritten).toContain("from '@vue/test-utils'")
    expect(rewritten).toContain("from 'vue'")
    expect(rewritten).toContain("from 'pinia'")
    expect(rewritten).toContain("import { useTodoStore } from './solution'")
  })

  it('rewrites parent-relative paths and mock/dynamic specifiers', () => {
    const source = [
      "import { useForm } from '../composables/use-form'",
      "vi.mock('./api-client')",
      "const mod = await import('./use-form')",
    ].join('\n')
    const rewritten = rewriteVueTestImports(source, false)

    expect(rewritten).not.toMatch(/use-form'|api-client/)
    expect(rewritten.match(/'\.\/solution'/g)).toHaveLength(3)
  })

  it('injects the solution as globals when a module test imports nothing', () => {
    const rewritten = rewriteVueTestImports(
      "test('counts', () => { expect(add(1, 2)).toBe(3) })",
      false
    )
    expect(rewritten).toContain("import * as solution from './solution'")
    expect(rewritten).toContain('Object.assign(globalThis, solution)')
  })

  it('does not inject globals for an SFC, whose export is a component', () => {
    const rewritten = rewriteVueTestImports("test('renders', () => {})", true)
    expect(rewritten).not.toContain('Object.assign(globalThis')
  })
})
