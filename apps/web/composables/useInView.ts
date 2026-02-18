import { onMounted, onUnmounted, type Ref, ref } from 'vue'

export function useInView(
  target: Ref<HTMLElement | null>,
  options?: { threshold?: number; rootMargin?: string }
) {
  const isInView = ref(false)
  let observer: IntersectionObserver | null = null

  onMounted(() => {
    if (!target.value) return

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            isInView.value = true
            observer?.disconnect()
          }
        }
      },
      {
        threshold: options?.threshold ?? 0.1,
        rootMargin: options?.rootMargin ?? '0px 0px -50px 0px',
      }
    )

    observer.observe(target.value)
  })

  onUnmounted(() => {
    observer?.disconnect()
  })

  return isInView
}
