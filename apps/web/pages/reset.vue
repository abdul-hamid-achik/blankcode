<script setup lang="ts">
import Button from '~/components/ui/button.vue'
import Card from '~/components/ui/card.vue'
import Input from '~/components/ui/input.vue'

definePageMeta({ guestOnly: true, middleware: 'auth' })

const route = useRoute()
const token = computed(() => (typeof route.query['token'] === 'string' ? route.query['token'] : ''))

const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const isLoading = ref(false)

async function handleSubmit() {
  error.value = ''
  if (!token.value) {
    error.value = 'This reset link is missing its token. Request a new one.'
    return
  }
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
    await $fetch('/api/account/password/reset', {
      method: 'POST',
      body: { token: token.value, password: password.value },
    })
    navigateTo('/login?reset=done')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Could not update the password'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="auth-container">
    <div class="auth-card">
      <div class="mb-8">
        <p class="eyebrow mb-2">password</p>
        <h1 class="display text-2xl">Choose a new password.</h1>
        <p class="mt-2 text-sm text-muted-foreground">
          The link in the email works once. After this, sign in with the new password.
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
            id="reset-password"
            v-model="password"
            label="New password"
            type="password"
            placeholder="••••••••"
            autocomplete="new-password"
            required
          />
          <Input
            id="reset-password-confirm"
            v-model="confirmPassword"
            label="Confirm password"
            type="password"
            placeholder="••••••••"
            autocomplete="new-password"
            required
          />
          <Button type="submit" :loading="isLoading" class="w-full">Update password</Button>
        </form>
      </Card>
    </div>
  </div>
</template>
