import { ref, type Ref } from 'vue'

export interface UseAsyncState<T> {
  data: Ref<T | null>
  error: Ref<Error | null>
  isLoading: Ref<boolean>
  execute: (...args: unknown[]) => Promise<T | null>
}

export function useAsync<T>(
  asyncFn: (...args: unknown[]) => Promise<T>,
  immediate = false
): UseAsyncState<T> {
  const data = ref<T | null>(null) as Ref<T | null>
  const error = ref<Error | null>(null)
  const isLoading = ref(false)

  async function execute(...args: unknown[]): Promise<T | null> {
    isLoading.value = true
    error.value = null

    try {
      const result = await asyncFn(...args)
      data.value = result
      return result
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
      return null
    } finally {
      isLoading.value = false
    }
  }

  if (immediate) {
    execute()
  }

  return { data, error, isLoading, execute }
}
