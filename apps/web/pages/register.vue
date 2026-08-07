<script setup lang="ts">
import Button from '~/components/ui/button.vue'
import Card from '~/components/ui/card.vue'
import Input from '~/components/ui/input.vue'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ guestOnly: true, middleware: 'auth' })

const authStore = useAuthStore()

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
    // Straight to picking a track. A brand-new account has nothing to review,
    // so the dashboard's only answer is "pick something new" — with one more
    // click in the way of the first exercise, right after the most expensive
    // commitment a visitor makes.
    navigateTo('/tracks')
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
        <h1 class="display text-2xl">Create a local account.</h1>
        <p class="mt-2 text-sm text-muted-foreground">
          There is no server but yours. Nothing leaves this machine.
        </p>
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
      </Card>

      <p class="text-center text-sm text-muted-foreground mt-4">
        Already have an account?
        <NuxtLink to="/login" class="text-primary hover:underline"> Sign in </NuxtLink>
      </p>
    </div>
  </div>
</template>
