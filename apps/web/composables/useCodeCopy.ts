import type { Ref } from 'vue'

/**
 * Puts a quiet "copy" button on every code block inside a container.
 *
 * Injected after mount rather than baked into the markdown pipeline, because
 * the blocks come out of @nuxt/content's renderer and this is the one
 * enhancement they need. The button is plain text in the product's mono —
 * no icon library for one glyph.
 */
export function useCodeCopy(container: Ref<HTMLElement | null>) {
  onMounted(() => {
    const root = container.value
    if (!root) return

    for (const pre of root.querySelectorAll('pre')) {
      // Interactive checkpoints have inputs inside their <pre>; a copy
      // button there would copy half-filled answers.
      if (pre.closest('.code-blank')) continue
      if (pre.querySelector('.code-copy')) continue

      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'code-copy'
      button.textContent = 'copy'
      button.setAttribute('aria-label', 'Copy code')
      button.addEventListener('click', () => {
        const code = pre.querySelector('code')?.textContent ?? pre.textContent ?? ''
        navigator.clipboard
          .writeText(code)
          .then(() => {
            button.textContent = 'copied'
            setTimeout(() => {
              button.textContent = 'copy'
            }, 1600)
          })
          .catch(() => {
            /* selection by hand still works */
          })
      })

      pre.style.position = 'relative'
      pre.appendChild(button)
    }
  })
}
