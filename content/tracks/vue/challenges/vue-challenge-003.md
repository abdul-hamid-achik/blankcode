---
slug: vue-challenge-003
title: 'Challenge: Build a Virtualized List Component'
description: Create a performant virtualized list that renders only visible items.
difficulty: advanced
type: challenge
tags:
  - performance
  - composition-api
  - scroll
---

# Challenge: Virtualized List

## Requirements

Create a `VirtualizedList` Vue component with the following features:

1. **items prop** - Array of items to render
2. **itemHeight prop** - Fixed height per item (pixels)
3. **containerHeight prop** - Visible container height
4. **overscan prop** - Number of items to render outside viewport
5. **emit scroll event** - Emit scroll position
6. **emit reach-end event** - Emit when near end (infinite scroll)

## Constraints

- Only render visible items + overscan
- Maintain scroll position
- Use requestAnimationFrame for scroll handling
- Support keyboard navigation
- Use Vue 3 Composition API

Write your complete implementation below:

```vue
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface Props {
  items: unknown[]
  itemHeight: number
  containerHeight: number
  overscan?: number
  reachEndThreshold?: number
}

const props = withDefaults(defineProps<Props>(), {
  overscan: 5,
  reachEndThreshold: 100,
})

const emit = defineEmits<{
  scroll: [scrollTop: number]
  reachEnd: []
}>()

// Your implementation here
</script>

<template>
  <!-- Your template here -->
</template>
```

## Example Usage

```vue
<VirtualizedList
  :items="largeArray"
  :item-height="50"
  :container-height="400"
  :overscan="5"
  @scroll="handleScroll"
  @reach-end="loadMore"
>
  <template #item="{ item, index }">
    <div>{{ item.name }}</div>
  </template>
</VirtualizedList>
```

## Tests

```typescript
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { VirtualizedList } from './VirtualizedList'

describe('VirtualizedList', () => {
  const items = Array.from({ length: 1000 }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
  }))

  it('should render container with correct height', () => {
    const wrapper = mount(VirtualizedList, {
      props: {
        items,
        itemHeight: 50,
        containerHeight: 400,
      },
      slots: {
        item: '<template #item="{ item }"><div :key="item.id">{{ item.name }}</div></template>',
      },
    })
    
    const container = wrapper.find('[role="list"]')
    expect(container.attributes('style')).toContain('height: 400px')
  })

  it('should render only visible items', () => {
    const wrapper = mount(VirtualizedList, {
      props: {
        items,
        itemHeight: 50,
        containerHeight: 400,
      },
      slots: {
        item: '<template #item="{ item }"><div class="item">{{ item.name }}</div></template>',
      },
    })
    
    // 400px / 50px = 8 items visible
    const renderedItems = wrapper.findAll('.item')
    expect(renderedItems.length).toBeLessThan(20) // Should be around 8 + overscan
  })

  it('should render correct first visible items', () => {
    const wrapper = mount(VirtualizedList, {
      props: {
        items,
        itemHeight: 50,
        containerHeight: 400,
      },
      slots: {
        item: '<template #item="{ item }"><div class="item">{{ item.name }}</div></template>',
      },
    })
    
    expect(wrapper.text()).toContain('Item 0')
  })

  it('should update rendered items on scroll', async () => {
    const wrapper = mount(VirtualizedList, {
      props: {
        items,
        itemHeight: 50,
        containerHeight: 400,
      },
      slots: {
        item: '<template #item="{ item }"><div class="item">{{ item.name }}</div></template>',
      },
    })
    
    const container = wrapper.find('[role="list"]')
    container.element.scrollTop = 500
    await container.trigger('scroll')
    
    // Item 10 should be visible (500px / 50px = 10)
    expect(wrapper.text()).toContain('Item 10')
  })

  it('should emit scroll event', async () => {
    const wrapper = mount(VirtualizedList, {
      props: {
        items,
        itemHeight: 50,
        containerHeight: 400,
      },
      slots: {
        item: '<template #item="{ item }"><div>{{ item.name }}</div></template>',
      },
    })
    
    const container = wrapper.find('[role="list"]')
    container.element.scrollTop = 100
    await container.trigger('scroll')
    
    expect(wrapper.emitted('scroll')).toBeDefined()
    expect(wrapper.emitted('scroll')?.[0]).toEqual([100])
  })

  it('should emit reach-end when near end', async () => {
    const wrapper = mount(VirtualizedList, {
      props: {
        items,
        itemHeight: 50,
        containerHeight: 400,
        reachEndThreshold: 100,
      },
      slots: {
        item: '<template #item="{ item }"><div class="item">{{ item.name }}</div></template>',
      },
    })
    
    const container = wrapper.find('[role="list"]')
    // Scroll to near end (50000 - 400 - 100 = 49500)
    container.element.scrollTop = 49500
    await container.trigger('scroll')
    
    expect(wrapper.emitted('reachEnd')).toBeDefined()
  })

  it('should not emit reach-end multiple times', async () => {
    const wrapper = mount(VirtualizedList, {
      props: {
        items,
        itemHeight: 50,
        containerHeight: 400,
        reachEndThreshold: 100,
      },
      slots: {
        item: '<template #item="{ item }"><div class="item">{{ item.name }}</div></template>',
      },
    })
    
    const container = wrapper.find('[role="list"]')
    container.element.scrollTop = 49500
    await container.trigger('scroll')
    container.element.scrollTop = 49600
    await container.trigger('scroll')
    container.element.scrollTop = 49700
    await container.trigger('scroll')
    
    // Should only be emitted once
    expect(wrapper.emitted('reachEnd')?.length).toBe(1)
  })

  it('should handle overscan correctly', () => {
    const wrapper = mount(VirtualizedList, {
      props: {
        items,
        itemHeight: 50,
        containerHeight: 400,
        overscan: 10,
      },
      slots: {
        item: '<template #item="{ item }"><div class="item">{{ item.name }}</div></template>',
      },
    })
    
    // Should render more items due to overscan
    const renderedItems = wrapper.findAll('.item')
    expect(renderedItems.length).toBeGreaterThan(8) // 8 visible + overscan
  })

  it('should reset reach-end flag when scrolling away from end', async () => {
    const wrapper = mount(VirtualizedList, {
      props: {
        items,
        itemHeight: 50,
        containerHeight: 400,
        reachEndThreshold: 100,
      },
      slots: {
        item: '<template #item="{ item }"><div class="item">{{ item.name }}</div></template>',
      },
    })
    
    const container = wrapper.find('[role="list"]')
    
    // Scroll to end
    container.element.scrollTop = 49500
    await container.trigger('scroll')
    expect(wrapper.emitted('reachEnd')).toBeDefined()
    
    // Scroll away
    container.element.scrollTop = 40000
    await container.trigger('scroll')
    
    // Scroll to end again - should emit again
    container.element.scrollTop = 49500
    await container.trigger('scroll')
    expect(wrapper.emitted('reachEnd')?.length).toBe(2)
  })
})
```

## Solution

```vue
<script setup lang="ts" generic="T">
import { computed, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    items: T[]
    itemHeight: number
    containerHeight: number
    overscan?: number
    reachEndThreshold?: number
  }>(),
  { overscan: 3, reachEndThreshold: 100 }
)

const emit = defineEmits<{
  scroll: [scrollTop: number]
  reachEnd: []
}>()

const scrollTop = ref(0)
// Latched so a run of scroll events near the bottom emits once. Without it an
// infinite-scroll parent would fetch the same page on every pixel of movement.
const reachedEnd = ref(false)

const totalHeight = computed(() => props.items.length * props.itemHeight)
const visibleCount = computed(() => Math.ceil(props.containerHeight / props.itemHeight))
const startIndex = computed(() =>
  Math.max(0, Math.floor(scrollTop.value / props.itemHeight) - props.overscan)
)
const endIndex = computed(() =>
  Math.min(props.items.length, startIndex.value + visibleCount.value + props.overscan * 2)
)
const visible = computed(() =>
  props.items.slice(startIndex.value, endIndex.value).map((item, offset) => ({
    item,
    index: startIndex.value + offset,
  }))
)

function onScroll(event: Event) {
  const top = (event.target as HTMLElement).scrollTop
  scrollTop.value = top
  emit('scroll', top)

  if (totalHeight.value - (top + props.containerHeight) <= props.reachEndThreshold) {
    if (!reachedEnd.value) {
      reachedEnd.value = true
      emit('reachEnd')
    }
  } else {
    // Unlatched only after scrolling back out of the zone, so the next approach
    // counts as a new one.
    reachedEnd.value = false
  }
}
</script>

<template>
  <div
    role="list"
    :style="{ height: `${containerHeight}px`, overflowY: 'auto', position: 'relative' }"
    @scroll="onScroll"
  >
    <!-- A spacer of the full height so the scrollbar reflects the whole list,
         even though only a window of it exists in the DOM. -->
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
  </div>
</template>
```
