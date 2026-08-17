<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import Button from '~/components/ui/button.vue'
import { useAuthStore } from '~/stores/auth'
import { usePreferencesStore } from '~/stores/preferences'
import { useReviewStore } from '~/stores/review'

/**
 * Signed in, this is a strip of controls, not a nav: wordmark, the sidebar
 * toggle (drawer below lg, collapse at lg+), theme, and two shortcuts —
 * settings and account. Navigation lives in the sidebar, whole; the header
 * used to duplicate Review here and that duplicate is gone, as is the
 * Sign out button, which now lives with the account section it belongs to.
 *
 * Signed out there is no sidebar, so the marketing nav stays here in full.
 */

interface Props {
  drawerOpen?: boolean
}

const props = withDefaults(defineProps<Props>(), { drawerOpen: false })
const emit = defineEmits<{ 'toggle-drawer': [] }>()

const authStore = useAuthStore()
const preferencesStore = usePreferencesStore()
const reviewStore = useReviewStore()

const mobileMenuOpen = ref(false)

const isDark = computed(() => preferencesStore.preferences.theme === 'dark')

function toggleDarkMode() {
  preferencesStore.setTheme(isDark.value ? 'light' : 'dark')
}

onMounted(() => {
  if (authStore.isAuthenticated) reviewStore.loadDueCount()
})

watch(
  () => authStore.isAuthenticated,
  (signedIn) => {
    if (signedIn) reviewStore.loadDueCount()
    // Signing in swaps this branch of the template for the sidebar-backed
    // one, which never reads this flag — reset it so a stale "open" does not
    // reappear if the account signs out again later in the same session.
    mobileMenuOpen.value = false
  }
)

/** Signed-out marketing nav. Paths, challenges, and the blog live in the footer. */
const marketingLinks = [
  { to: '/tracks', label: 'Tracks' },
  { to: '/reading', label: 'Reading' },
  { to: '/tutorials', label: 'Tutorials' },
  { to: '/connect', label: 'Connect' },
]

function closeMobileMenu() {
  mobileMenuOpen.value = false
}
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-rule bg-background/90 backdrop-blur-sm">
    <div class="container flex h-14 items-center gap-4">
      <!-- The wordmark is the product's gesture: a word with a blank in it. -->
      <NuxtLink to="/" class="display text-base shrink-0" aria-label="BlankCode home">
        <span>blank</span><span class="blank-slot px-1.5">code</span>
      </NuxtLink>

      <template v-if="authStore.isAuthenticated">
        <button
          class="rounded p-2 text-muted-foreground transition-colors hover:text-foreground"
          :aria-expanded="props.drawerOpen"
          aria-controls="app-sidebar-drawer"
          aria-label="Toggle sidebar"
          @click="emit('toggle-drawer')"
        >
          <svg
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path
              v-if="!props.drawerOpen"
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M4 6h16M4 12h16M4 18h16"
            />
            <path v-else stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div class="flex-1" />

        <NuxtLink
          to="/review"
          class="relative rounded px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
          :class="{ 'text-foreground': reviewStore.dueCount > 0 }"
        >
          Review
          <span
            v-if="reviewStore.dueCount > 0"
            class="ml-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-signal px-1 font-mono text-[10px] font-semibold text-signal-foreground"
          >
            {{ reviewStore.dueCount > 99 ? '99+' : reviewStore.dueCount }}
          </span>
        </NuxtLink>

        <button
          class="rounded p-2 text-muted-foreground transition-colors hover:text-foreground"
          :aria-label="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
          @click="toggleDarkMode"
        >
          <svg
            v-if="isDark"
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          <svg
            v-else
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
            />
          </svg>
        </button>

        <!-- Two shortcuts, not a menu: where your account lives, and where
             it is configured. Everything else is one hamburger away. -->
        <NuxtLink
          to="/progress"
          class="rounded p-2 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Your progress"
          title="Progress"
        >
          <svg
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 19V9m6 10V5m6 14v-6m6 6V3" />
          </svg>
        </NuxtLink>
        <NuxtLink
          to="/settings"
          class="rounded p-2 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Settings"
          title="Settings"
        >
          <svg
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </NuxtLink>
      </template>

      <template v-else>
        <nav class="hidden md:flex items-center gap-1 ml-2" aria-label="Main">
          <NuxtLink v-for="link in marketingLinks" :key="link.to" :to="link.to" class="nav-link">
            {{ link.label }}
          </NuxtLink>
        </nav>

        <div class="hidden md:flex items-center gap-2 ml-auto">
          <button
            class="rounded p-2 text-muted-foreground transition-colors hover:text-foreground"
            :aria-label="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
            @click="toggleDarkMode"
          >
            <svg
              v-if="isDark"
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <svg
              v-else
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
              />
            </svg>
          </button>

          <Button to="/login" variant="ghost" size="sm">Sign in</Button>
          <Button to="/register" size="sm">Create account</Button>
        </div>

        <button
          class="rounded p-2 text-muted-foreground transition-colors hover:text-foreground md:hidden ml-auto"
          :aria-expanded="mobileMenuOpen"
          aria-label="Toggle menu"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <svg
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path
              v-if="!mobileMenuOpen"
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M4 6h16M4 12h16M4 18h16"
            />
            <path v-else stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </template>
    </div>

    <nav
      v-if="!authStore.isAuthenticated && mobileMenuOpen"
      class="border-t border-rule bg-background px-4 py-3 md:hidden"
      aria-label="Main"
    >
      <NuxtLink
        v-for="link in marketingLinks"
        :key="link.to"
        :to="link.to"
        class="mobile-link"
        @click="closeMobileMenu"
      >
        {{ link.label }}
      </NuxtLink>

      <hr class="my-2 border-rule" />

      <button class="mobile-link w-full text-left" @click="toggleDarkMode">
        {{ isDark ? 'Light theme' : 'Dark theme' }}
      </button>

      <NuxtLink to="/login" class="mobile-link" @click="closeMobileMenu">Sign in</NuxtLink>
      <NuxtLink to="/register" class="mobile-link" @click="closeMobileMenu"
        >Create account</NuxtLink
      >
    </nav>
  </header>
</template>

<style scoped>
.nav-link {
  display: inline-flex;
  align-items: center;
  border-radius: 2px;
  padding: 0.375rem 0.625rem;
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
  transition: color 0.15s ease;
}

.nav-link:hover {
  color: hsl(var(--foreground));
}

.nav-link.router-link-active {
  color: hsl(var(--foreground));
  box-shadow: inset 0 -2px 0 hsl(var(--signal));
}

.mobile-link {
  display: block;
  border-radius: 2px;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
}

.mobile-link:hover {
  background: hsl(var(--muted));
  color: hsl(var(--foreground));
}
</style>
