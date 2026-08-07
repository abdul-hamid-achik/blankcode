---
slug: vue-challenge-005
title: 'Challenge: Build an Infinite Scroll with Data Fetching'
description: Create a performant infinite scroll component with data fetching and caching.
difficulty: expert
type: challenge
tags:
  - performance
  - data-fetching
  - caching
---

# Challenge: Infinite Scroll with Caching

## Requirements

Create an `InfiniteScroll` Vue component with the following features:

1. **fetchData prop** - Async function to fetch page of data
2. **itemHeight prop** - Fixed/predicted item height
3. **threshold prop** - How close to bottom before fetching
4. **Cache results** - Don't refetch loaded pages
5. **Loading states** - Per-page loading indicators
6. **Error handling** - Retry failed pages
7. **Virtual scrolling** - Only render visible items

## Constraints

- Cancel pending requests on unmount
- Handle scroll position during data loading
- Support pull-to-refresh
- Debounce scroll events
- Memory-efficient (cleanup old cache)

Write your complete implementation below:

```vue
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

// Your implementation here
</script>

<template>
  <!-- Your template here -->
</template>
```

## Example Usage

```vue
<InfiniteScroll
  :fetch-data="fetchItems"
  :item-height="60"
  :threshold="200"
  :cache-size="10"
>
  <template #item="{ item }">
    <ItemCard :item="item" />
  </template>
</InfiniteScroll>
```

## Tests

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { InfiniteScroll } from './InfiniteScroll'

interface Row {
  id: number
  name: string
}

const mockFetchData = vi.fn<(page: number) => Promise<{ items: Row[]; hasMore: boolean }>>()

beforeEach(() => {
  vi.clearAllMocks()
})

function page(from: number, count: number, hasMore: boolean) {
  return {
    items: Array.from({ length: count }, (_, i) => ({ id: from + i, name: `Item ${from + i}` })),
    hasMore,
  }
}

function render(props: Record<string, unknown> = {}) {
  return mount(InfiniteScroll, {
    props: { fetchData: mockFetchData, itemHeight: 50, ...props },
    slots: {
      item: '<template #item="{ item }"><div class="row">{{ item.name }}</div></template>',
    },
  })
}

async function scrollTo(wrapper: ReturnType<typeof render>, top: number) {
  const container = wrapper.find('[role="list"]')
  // `target` is a read-only accessor on Event, so it cannot be set from
  // trigger options; the handler reads the element's own scrollTop.
  container.element.scrollTop = top
  await container.trigger('scroll')
  await flushPromises()
}

describe('InfiniteScroll', () => {
  it('should render initial items', async () => {
    mockFetchData.mockResolvedValue(page(1, 2, true))

    const wrapper = render()
    await flushPromises()

    expect(wrapper.text()).toContain('Item 1')
    expect(wrapper.text()).toContain('Item 2')
  })

  it('should fetch next page when scrolling near bottom', async () => {
    mockFetchData.mockResolvedValueOnce(page(1, 20, true))
    mockFetchData.mockResolvedValueOnce(page(21, 20, false))

    const wrapper = render({ containerHeight: 400, threshold: 100 })
    await flushPromises()
    expect(mockFetchData).toHaveBeenCalledTimes(1)

    await scrollTo(wrapper, 800)
    expect(mockFetchData).toHaveBeenCalledTimes(2)
  })

  it('should not refetch a list that does not overflow its container', async () => {
    mockFetchData.mockResolvedValue(page(1, 1, true))

    const wrapper = render({ containerHeight: 400 })
    await flushPromises()
    expect(mockFetchData).toHaveBeenCalledTimes(1)

    // One 50px row cannot be scrolled inside a 400px window, so no scroll event
    // on it means the reader reached the end of anything.
    await scrollTo(wrapper, 100)
    await scrollTo(wrapper, 0)

    expect(mockFetchData).toHaveBeenCalledTimes(1)
  })

  it('should show loading state', () => {
    mockFetchData.mockImplementation(() => new Promise(() => {}))

    const wrapper = render()
    expect(wrapper.text()).toContain('Loading...')
  })

  it('should show error state and retry', async () => {
    mockFetchData.mockRejectedValueOnce(new Error('Failed to fetch'))
    mockFetchData.mockResolvedValueOnce(page(1, 1, true))

    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('Error loading items')

    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Item 1')
  })

  it('should only render the items in view', async () => {
    mockFetchData.mockResolvedValue(page(1, 200, false))

    const wrapper = render({ containerHeight: 400 })
    await flushPromises()

    // 400px / 50px is eight rows, plus overscan — nowhere near two hundred.
    expect(wrapper.findAll('.row').length).toBeLessThan(30)
  })

  it('should support pull-to-refresh', async () => {
    mockFetchData.mockResolvedValue(page(1, 1, false))

    const wrapper = render({ enablePullToRefresh: true })
    await flushPromises()
    expect(mockFetchData).toHaveBeenCalledTimes(1)

    await scrollTo(wrapper, -100)
    expect(mockFetchData).toHaveBeenCalledTimes(2)
  })

  it('should handle empty results', async () => {
    mockFetchData.mockResolvedValue({ items: [], hasMore: false })

    const wrapper = render()
    await flushPromises()

    expect(wrapper.text()).toContain('No more items')
  })

  it('should emit scroll event', async () => {
    mockFetchData.mockResolvedValue(page(1, 20, false))

    const wrapper = render({ containerHeight: 400 })
    await flushPromises()

    await scrollTo(wrapper, 100)

    expect(wrapper.emitted('scroll')).toBeDefined()
    expect(wrapper.emitted('scroll')?.[0]).toEqual([100])
  })

  it('should ignore a request that resolves after unmount', async () => {
    let resolvePromise: (value: { items: Row[]; hasMore: boolean }) => void = () => {}
    mockFetchData.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve
        })
    )

    const wrapper = render()
    wrapper.unmount()

    // Writing to a ref after unmount is not an error in Vue, but acting on a
    // response for a component nobody is looking at is still a bug — and it is
    // how a stale page ends up rendered when the component is remounted.
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => resolvePromise({ items: [], hasMore: true })).not.toThrow()
    await flushPromises()
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
```

## Solution

```vue
<script setup lang="ts" generic="T">
import { computed, onUnmounted, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    fetchData: (page: number) => Promise<{ items: T[]; hasMore: boolean }>
    itemHeight: number
    containerHeight?: number
    threshold?: number
    overscan?: number
    enablePullToRefresh?: boolean
  }>(),
  { containerHeight: 400, threshold: 100, overscan: 3, enablePullToRefresh: false }
)

const emit = defineEmits<{
  scroll: [scrollTop: number]
}>()

const items = ref<T[]>([]) as { value: T[] }
const hasMore = ref(true)
const loading = ref(false)
const error = ref<string | null>(null)
const scrollTop = ref(0)

let nextPage = 1
let inFlight = false
// Pages already asked for, so a burst of scroll events near the bottom does not
// request the same one repeatedly.
const requested = new Set<number>()
let alive = true

onUnmounted(() => {
  alive = false
})

async function load(pageNumber: number, replace = false) {
  if (inFlight) return
  if (!replace && requested.has(pageNumber)) return

  inFlight = true
  requested.add(pageNumber)
  loading.value = true
  error.value = null

  try {
    const result = await props.fetchData(pageNumber)
    // The component may be gone by the time this resolves; acting on it would
    // render a page nobody asked to see.
    if (!alive) return
    items.value = replace ? result.items : [...items.value, ...result.items]
    hasMore.value = result.hasMore
    nextPage = pageNumber + 1
  } catch (cause) {
    if (!alive) return
    error.value = cause instanceof Error ? cause.message : String(cause)
    // Dropped so Retry is allowed to ask for it again.
    requested.delete(pageNumber)
  } finally {
    inFlight = false
    if (alive) loading.value = false
  }
}

void load(1)

const totalHeight = computed(() => items.value.length * props.itemHeight)
const visibleCount = computed(() => Math.ceil(props.containerHeight / props.itemHeight))
const startIndex = computed(() =>
  Math.max(0, Math.floor(scrollTop.value / props.itemHeight) - props.overscan)
)
const endIndex = computed(() =>
  Math.min(items.value.length, startIndex.value + visibleCount.value + props.overscan * 2)
)
const visible = computed(() =>
  items.value.slice(startIndex.value, endIndex.value).map((item, offset) => ({
    item,
    index: startIndex.value + offset,
  }))
)

function onScroll(event: Event) {
  const top = (event.target as HTMLElement).scrollTop
  scrollTop.value = Math.max(0, top)
  emit('scroll', top)

  if (props.enablePullToRefresh && top < 0) {
    requested.clear()
    nextPage = 1
    void load(1, true)
    return
  }

  // A list shorter than its container cannot be scrolled to its end, so a
  // scroll event on one says nothing about wanting more.
  if (totalHeight.value <= props.containerHeight) return
  if (!hasMore.value || inFlight) return

  if (totalHeight.value - (top + props.containerHeight) <= props.threshold) {
    void load(nextPage)
  }
}

function retry() {
  void load(nextPage)
}
</script>

<template>
  <div
    role="list"
    :style="{ height: `${containerHeight}px`, overflowY: 'auto', position: 'relative' }"
    @scroll="onScroll"
  >
    <div :style="{ height: `${totalHeight}px`, position: 'relative' }">
      <div
        v-for="entry in visible"
        :key="entry.index"
        :style="{
          position: 'absolute',
          top: `${entry.index * itemHeight}px`,
          height: `${itemHeight}px`,
          width: '100%',
        }"
      >
        <slot name="item" :item="entry.item" :index="entry.index" />
      </div>
    </div>

    <div v-if="loading">Loading...</div>

    <div v-if="error">
      <span>Error loading items</span>
      <button type="button" @click="retry">Retry</button>
    </div>

    <div v-if="!loading && !error && !hasMore && items.length === 0">No more items</div>
  </div>
</template>
```
