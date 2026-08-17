<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useReviewStore } from '~/stores/review'
import { AUTH_COOKIE_OPTIONS } from '~/utils/auth-cookie'

/**
 * Signed-in navigation, in full.
 *
 * The header used to fold everything past two links into a "More" dropdown —
 * that dropdown is gone. This is where the rest of the product lives now:
 * persistent at lg+ (part of the page, not an overlay on it), a drawer below
 * that the header's hamburger opens.
 */

interface Props {
  open: boolean
  /** Hidden at lg+ by the user's stored preference. */
  collapsed?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ close: [] }>()

const authStore = useAuthStore()
const reviewStore = useReviewStore()
const route = useRoute()
const asideEl = ref<HTMLElement | null>(null)

/**
 * Whether this account may see the operator view. The same conditional the
 * header used to run before the admin link moved here: ask once, only while
 * signed in — this component never mounts otherwise — and the browser is
 * told yes or nothing, never the candidate list.
 */
const isAdmin = ref(false)

onMounted(async () => {
  try {
    const token = useCookie<string | null>('token', AUTH_COOKIE_OPTIONS).value
    if (!token) return
    await $fetch('/api/admin/check', { headers: { Authorization: `Bearer ${token}` } })
    isAdmin.value = true
  } catch {
    // A 404 is the ordinary answer for almost everyone. Nothing to report.
  }
})

interface SidebarLink {
  to: string
  label: string
}

interface SidebarSection {
  label: string
  links: SidebarLink[]
}

const sections = computed<SidebarSection[]>(() => {
  const account: SidebarLink[] = [
    { to: '/progress', label: 'Progress' },
    { to: '/achievements', label: 'Achievements' },
    { to: '/settings', label: 'Settings' },
  ]
  if (isAdmin.value) account.push({ to: '/admin', label: 'Admin' })

  return [
    {
      label: 'practice',
      links: [
        { to: '/dashboard', label: 'Dashboard' },
        { to: '/review', label: 'Review' },
        { to: '/tracks', label: 'Tracks' },
        { to: '/paths', label: 'Paths' },
        { to: '/challenges', label: 'Challenges' },
        { to: '/reading', label: 'Reading' },
        { to: '/drills', label: 'Drills' },
      ],
    },
    {
      label: 'learn',
      links: [
        { to: '/tutorials', label: 'Tutorials' },
        { to: '/blog', label: 'Blog' },
      ],
    },
    {
      label: 'your agent',
      links: [{ to: '/connect', label: 'Connect' }],
    },
    {
      label: 'account',
      links: account,
    },
  ]
})

/**
 * A link is active on its own route and anything nested under it — so
 * `/tracks` stays marked while reading `/tracks/python/loops`.
 */
function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(`${path}/`)
}

function handleKeydown(event: KeyboardEvent) {
  if (props.open && event.key === 'Escape') emit('close')
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))

// Keyboard-usable without a full focus-trap library: opening the drawer
// moves focus inside it, so the next Tab press lands on its first link
// instead of whatever was behind it.
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) nextTick(() => asideEl.value?.focus())
  }
)
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
    aria-hidden="true"
    @click="emit('close')"
  />

  <aside
    id="app-sidebar-drawer"
    ref="asideEl"
    tabindex="-1"
    aria-label="Sidebar"
    class="fixed inset-y-0 left-0 z-50 w-60 -translate-x-full overflow-y-auto border-r border-rule bg-background transition-transform duration-200 ease-in-out focus:outline-none lg:sticky lg:top-14 lg:z-auto lg:h-[calc(100vh-3.5rem)] lg:w-60 lg:shrink-0 lg:translate-x-0 lg:transition-none"
    :class="{ 'translate-x-0': open, 'lg:hidden': collapsed }"
  >
    <nav aria-label="Primary" class="flex flex-col gap-0.5 px-2 py-4">
      <template v-for="section in sections" :key="section.label">
        <div class="eyebrow px-3 pb-1.5 pt-4 first:pt-0">{{ section.label }}</div>
        <NuxtLink
          v-for="link in section.links"
          :key="link.to"
          :to="link.to"
          class="sidebar-link"
          :class="{ 'sidebar-link--active': isActive(link.to) }"
          :aria-current="isActive(link.to) ? 'page' : undefined"
          @click="emit('close')"
        >
          <span>{{ link.label }}</span>
          <span
            v-if="link.to === '/review' && reviewStore.dueCount > 0"
            class="ml-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-signal px-1 font-mono text-[10px] font-semibold text-signal-foreground"
          >
            {{ reviewStore.dueCount > 99 ? '99+' : reviewStore.dueCount }}
          </span>
        </NuxtLink>
      </template>

      <!-- The way out lives with the account, not floating in the header. -->
      <hr class="mx-3 my-3 border-rule" />
      <button
        class="sidebar-link w-full text-left"
        type="button"
        @click="
          () => {
            emit('close')
            authStore.logout()
            navigateTo('/')
          }
        "
      >
        Sign out
      </button>
    </nav>
  </aside>
</template>

<style scoped>
.sidebar-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  border-radius: 2px;
  border-left: 2px solid transparent;
  padding: 0.5rem 0.75rem;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.sidebar-link:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--muted) / 0.5);
}

.sidebar-link--active {
  color: hsl(var(--foreground));
  border-left-color: hsl(var(--signal));
  background: hsl(var(--muted) / 0.35);
}
</style>
