<script setup lang="ts">
import Button from '~/components/ui/button.vue'
import Card from '~/components/ui/card.vue'
import Input from '~/components/ui/input.vue'
import { usePageSeo } from '~/composables/usePageSeo'

definePageMeta({ guestOnly: true, middleware: 'auth' })

usePageSeo({
  title: 'Reset the password',
  description: 'If that address has an account, a reset link goes there.',
  path: '/forgot',
})

const email = ref('')
const sent = ref(false)
const error = ref('')
const isLoading = ref(false)

async function handleSubmit() {
  error.value = ''
  isLoading.value = true
  try {
    await $fetch('/api/account/password/forgot', {
      method: 'POST',
      body: { email: email.value },
    })
    sent.value = true
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Could not send the reset link'
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
        <h1 class="display text-2xl">Reset the password.</h1>
        <p class="mt-2 text-sm text-muted-foreground">
          If that address has an account, a link goes there. The link works once, for 30 minutes.
        </p>
      </div>

      <Card>
        <p v-if="sent" class="text-sm leading-relaxed">
          If that address has an account, a link is on its way. Check the inbox, including spam.
        </p>
        <form v-else @submit.prevent="handleSubmit" class="w-full space-y-4">
          <div
            v-if="error"
            class="border-l-2 border-fail bg-fail/5 px-4 py-2 text-sm text-fail"
            role="alert"
          >
            {{ error }}
          </div>
          <Input
            id="forgot-email"
            v-model="email"
            label="Email"
            type="email"
            placeholder="you@example.com"
            autocomplete="email"
            required
          />
          <Button type="submit" :loading="isLoading" class="w-full">Send the link</Button>
        </form>
      </Card>

      <p class="text-center text-sm text-muted-foreground mt-4">
        <NuxtLink to="/login" class="text-primary hover:underline">Back to sign in</NuxtLink>
      </p>
    </div>
  </div>
</template>
