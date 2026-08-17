<script setup lang="ts">
import OauthButtons from '~/components/auth/oauth-buttons.vue'
import Button from '~/components/ui/button.vue'
import Card from '~/components/ui/card.vue'
import Input from '~/components/ui/input.vue'
import { useAuthStore } from '~/stores/auth'
import { REGISTER_BLURB, REGISTER_HEADING } from '~/utils/auth-copy'
import { destinationHint, safeInternalRedirect } from '~/utils/auth-redirect'
import { FIRST_SITTING_HREF } from '~/utils/exercise-href'
import { usePageSeo } from '~/composables/usePageSeo'

definePageMeta({ guestOnly: true, middleware: 'auth' })

const route = useRoute()
const authStore = useAuthStore()
const redirectTo = computed(() => safeInternalRedirect(route.query['redirect'], FIRST_SITTING_HREF))

usePageSeo({
  title: 'Create an account',
  description: 'Progress and the review schedule live with the account.',
  path: '/register',
})
const hint = computed(() => destinationHint(redirectTo.value))

const email = ref('')
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const isLoading = ref(false)

async function handleSubmit() {
  error.value = ''

  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match'
    return
  }

  if (password.value.length < 8) {
    error.value = 'Password must be at least 8 characters'
    return
  }

  isLoading.value = true

  try {
    await authStore.register(email.value, username.value, password.value)
    // Honor the same redirect login uses. A guest who picked an exercise
    // and then created an account should land on that exercise. The default
    // is the first TypeScript blank — a new account has nothing due, so
    // sending them to /tracks adds a click before the first sitting.
    navigateTo(redirectTo.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Registration failed'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="auth-container">
    <div class="auth-card">
      <div class="mb-8">
        <p class="eyebrow mb-2">create account</p>
        <h1 class="display text-2xl">{{ REGISTER_HEADING }}</h1>
        <p class="mt-2 text-sm text-muted-foreground">{{ REGISTER_BLURB }}</p>
        <p v-if="hint" class="mt-2 font-mono text-xs text-muted-foreground">Then: {{ hint }}.</p>
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
            id="register-email"
            v-model="email"
            label="Email"
            type="email"
            placeholder="you@example.com"
            autocomplete="email"
            required
          />

          <Input
            id="register-username"
            v-model="username"
            label="Username"
            type="text"
            placeholder="johndoe"
            autocomplete="username"
            required
          />

          <Input
            id="register-password"
            v-model="password"
            label="Password"
            type="password"
            placeholder="••••••••"
            autocomplete="new-password"
            required
          />

          <Input
            id="register-password-confirm"
            v-model="confirmPassword"
            label="Confirm Password"
            type="password"
            placeholder="••••••••"
            autocomplete="new-password"
            required
          />

          <Button type="submit" :loading="isLoading" class="w-full"> Create account </Button>
        </form>
        <OauthButtons class="mt-4" :redirect="redirectTo" />
      </Card>

      <p class="text-center text-sm text-muted-foreground mt-4">
        Already have an account?
        <NuxtLink
          :to="
            redirectTo === '/tracks'
              ? '/login'
              : `/login?redirect=${encodeURIComponent(redirectTo)}`
          "
          class="text-primary hover:underline"
        >
          Sign in
        </NuxtLink>
      </p>
    </div>
  </div>
</template>
