<script setup lang="ts">
import OauthButtons from '~/components/auth/oauth-buttons.vue'
import Button from '~/components/ui/button.vue'
import Card from '~/components/ui/card.vue'
import Input from '~/components/ui/input.vue'
import { useAuthStore } from '~/stores/auth'
import { LOGIN_BLURB, LOGIN_HEADING } from '~/utils/auth-copy'
import { destinationHint, safeInternalRedirect } from '~/utils/auth-redirect'
import { usePageSeo } from '~/composables/usePageSeo'
import { oauthErrorMessage } from '~/utils/oauth-error'

definePageMeta({ guestOnly: true, middleware: 'auth' })

const route = useRoute()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const error = ref('')
const isLoading = ref(false)

const redirectTo = computed(() => safeInternalRedirect(route.query['redirect']))
const hint = computed(() => destinationHint(redirectTo.value))
const resetDone = computed(() => route.query['reset'] === 'done')

usePageSeo({
  title: 'Sign in',
  description: 'Your progress and review schedule live with your account.',
  path: '/login',
})

onMounted(() => {
  const fromOauth = oauthErrorMessage(route.query['error'])
  if (fromOauth) error.value = fromOauth
})

async function handleSubmit() {
  error.value = ''
  isLoading.value = true

  try {
    await authStore.login(email.value, password.value)
    navigateTo(redirectTo.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Login failed'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="auth-container">
    <div class="auth-card">
      <div class="mb-8">
        <p class="eyebrow mb-2">sign in</p>
        <h1 class="display text-2xl">{{ LOGIN_HEADING }}</h1>
        <p class="mt-2 text-sm text-muted-foreground">{{ LOGIN_BLURB }}</p>
        <p v-if="hint" class="mt-2 font-mono text-xs text-muted-foreground">
          Continue to {{ hint }}.
        </p>
        <p v-if="resetDone" class="mt-2 text-sm text-pass">Password updated. Sign in with it.</p>
      </div>

      <Card>
        <form @submit.prevent="handleSubmit" class="w-full space-y-4">
          <div
            v-if="error"
            class="border-l-2 border-fail bg-fail/5 px-4 py-2 text-sm text-fail"
            role="alert"
          >
            {{ error }}
          </div>

          <Input
            id="login-email"
            v-model="email"
            label="Email"
            type="email"
            placeholder="you@example.com"
            autocomplete="email"
            required
          />

          <Input
            id="login-password"
            v-model="password"
            label="Password"
            type="password"
            placeholder="••••••••"
            autocomplete="current-password"
            required
          />

          <Button type="submit" :loading="isLoading" class="w-full"> Sign in </Button>
        </form>
        <p class="mt-3 text-center text-sm">
          <NuxtLink
            to="/forgot"
            class="text-muted-foreground hover:text-foreground hover:underline"
          >
            Forgot password
          </NuxtLink>
        </p>
        <OauthButtons class="mt-4" :redirect="redirectTo" />
      </Card>

      <p class="text-center text-sm text-muted-foreground mt-4">
        Don't have an account?
        <NuxtLink
          :to="
            redirectTo === '/dashboard'
              ? '/register'
              : `/register?redirect=${encodeURIComponent(redirectTo)}`
          "
          class="text-primary hover:underline"
        >
          Sign up
        </NuxtLink>
      </p>
    </div>
  </div>
</template>
