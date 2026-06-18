<template>
  <div
    class="min-h-screen flex items-center justify-center px-4"
    style="background: var(--bg);"
  >
    <div class="w-full max-w-xs">

      <!-- Brand -->
      <div class="text-center mb-8">
        <h1 class="text-2xl font-semibold" style="color: var(--accent);">AVAtar</h1>
        <p class="text-sm mt-1" style="color: var(--muted);">Lagerverwaltung</p>
      </div>

      <!-- Card -->
      <div
        class="rounded-xl p-6"
        style="background: var(--card); border: 1px solid var(--border);"
      >
        <form @submit.prevent="handleLogin" novalidate>

          <!-- Username -->
          <div class="mb-4">
            <label class="block text-xs mb-1.5 font-medium" style="color: var(--muted);">
              Benutzername
            </label>
            <input
              v-model="username"
              type="text"
              autocomplete="username"
              autofocus
              placeholder="Benutzername eingeben"
              class="w-full px-3 py-2.5 rounded-lg text-sm transition-colors"
              style="
                background: var(--surface);
                border: 1px solid var(--border);
                color: var(--text);
                outline: none;
              "
              :disabled="loading"
              @focus="e => e.target.style.borderColor = 'var(--accent)'"
              @blur="e => e.target.style.borderColor  = 'var(--border)'"
            />
          </div>

          <!-- Password -->
          <div class="mb-5">
            <label class="block text-xs mb-1.5 font-medium" style="color: var(--muted);">
              Passwort
            </label>
            <input
              v-model="password"
              type="password"
              autocomplete="current-password"
              placeholder="Passwort eingeben"
              class="w-full px-3 py-2.5 rounded-lg text-sm transition-colors"
              style="
                background: var(--surface);
                border: 1px solid var(--border);
                color: var(--text);
                outline: none;
              "
              :disabled="loading"
              @focus="e => e.target.style.borderColor = 'var(--accent)'"
              @blur="e => e.target.style.borderColor  = 'var(--border)'"
            />
          </div>

          <!-- Error message -->
          <div
            v-if="error"
            class="mb-4 px-3 py-2 rounded-lg text-sm"
            style="background: rgba(239,68,68,.1); color: var(--error);"
          >
            {{ error }}
          </div>

          <!-- Submit -->
          <button
            type="submit"
            class="w-full py-2.5 rounded-lg text-sm font-medium transition-opacity"
            style="background: var(--accent); color: #fff;"
            :style="loading ? 'opacity: .6; cursor: not-allowed;' : ''"
            :disabled="loading"
          >
            {{ loading ? 'Anmelden…' : 'Anmelden' }}
          </button>

        </form>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref }         from 'vue'
import { useRouter }   from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router   = useRouter()
const auth     = useAuthStore()
const username = ref('')
const password = ref('')
const loading  = ref(false)
const error    = ref('')

async function handleLogin() {
  if (!username.value.trim() || !password.value) return
  loading.value = true
  error.value   = ''
  try {
    await auth.login(username.value.trim(), password.value)
    router.push('/dashboard')
  } catch (err) {
    error.value = err.response?.data?.error ?? 'Anmeldung fehlgeschlagen'
    password.value = ''
  } finally {
    loading.value = false
  }
}
</script>
