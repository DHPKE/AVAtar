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

      <!-- Mode toggle -->
      <div class="flex rounded-lg p-1 mb-4" style="background: var(--surface); border: 1px solid var(--border);">
        <button
          class="flex-1 py-2 rounded-md text-sm font-medium transition-colors"
          :style="mode === 'password'
            ? 'background: var(--card); color: var(--text);'
            : 'color: var(--muted);'"
          @click="switchMode('password')"
        >
          Anmelden
        </button>
        <button
          class="flex-1 py-2 rounded-md text-sm font-medium transition-colors"
          :style="mode === 'code'
            ? 'background: var(--card); color: var(--text);'
            : 'color: var(--muted);'"
          @click="switchMode('code')"
        >
          Kürzel
        </button>
      </div>

      <!-- Card -->
      <div
        class="rounded-xl p-6"
        style="background: var(--card); border: 1px solid var(--border);"
      >
        <!-- ── Password login ─────────────────────────────────────────────────── -->
        <form v-if="mode === 'password'" @submit.prevent="handleLogin" novalidate>
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
              style="background: var(--surface); border: 1px solid var(--border); color: var(--text); outline: none;"
              :disabled="loading"
              @focus="e => e.target.style.borderColor = 'var(--accent)'"
              @blur="e => e.target.style.borderColor  = 'var(--border)'"
            />
          </div>

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
              style="background: var(--surface); border: 1px solid var(--border); color: var(--text); outline: none;"
              :disabled="loading"
              @focus="e => e.target.style.borderColor = 'var(--accent)'"
              @blur="e => e.target.style.borderColor  = 'var(--border)'"
            />
          </div>

          <div v-if="error" class="mb-4 px-3 py-2 rounded-lg text-sm" style="background: rgba(239,68,68,.1); color: var(--error);">
            {{ error }}
          </div>

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

        <!-- ── Kürzel (shortcode) + PIN login — large touch-friendly inputs ────── -->
        <form v-else @submit.prevent="handleCodeLogin" novalidate>
          <div class="mb-4">
            <label class="block text-xs mb-2 font-medium text-center" style="color: var(--muted);">
              Kürzel
            </label>
            <input
              ref="codeInput"
              v-model="code"
              type="text"
              inputmode="text"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="characters"
              spellcheck="false"
              maxlength="6"
              placeholder="HLD"
              class="w-full text-center text-3xl font-bold tracking-widest uppercase rounded-xl px-4 transition-colors"
              style="height: 64px; background: var(--surface); border: 2px solid var(--border); color: var(--accent); outline: none;"
              :disabled="loading"
              @input="code = code.toUpperCase()"
              @keydown.enter.prevent="focusPin"
              @focus="e => e.target.style.borderColor = 'var(--accent)'"
              @blur="e => e.target.style.borderColor  = 'var(--border)'"
            />
          </div>

          <div class="mb-5">
            <label class="block text-xs mb-2 font-medium text-center" style="color: var(--muted);">
              PIN
            </label>
            <input
              ref="pinInput"
              v-model="pin"
              type="password"
              inputmode="numeric"
              pattern="[0-9]*"
              autocomplete="off"
              spellcheck="false"
              maxlength="5"
              placeholder="• • • • •"
              class="w-full text-center text-3xl font-bold tracking-[0.4em] rounded-xl px-4 transition-colors"
              style="height: 64px; background: var(--surface); border: 2px solid var(--border); color: var(--text); outline: none;"
              :disabled="loading"
              @input="pin = pin.replace(/[^0-9]/g, '')"
              @keydown.enter="handleCodeLogin"
              @focus="e => e.target.style.borderColor = 'var(--accent)'"
              @blur="e => e.target.style.borderColor  = 'var(--border)'"
            />
          </div>

          <div v-if="error" class="mb-4 px-3 py-2 rounded-lg text-sm text-center" style="background: rgba(239,68,68,.1); color: var(--error);">
            {{ error }}
          </div>

          <button
            type="submit"
            class="w-full rounded-xl text-lg font-semibold transition-opacity active:opacity-80"
            style="height: 60px; background: var(--accent); color: #fff;"
            :style="!canSubmitCode ? 'opacity: .5; cursor: not-allowed;' : ''"
            :disabled="!canSubmitCode"
          >
            {{ loading ? 'Anmelden…' : 'Anmelden' }}
          </button>

          <p class="text-xs text-center mt-3" style="color: var(--muted);">
            Schnellanmeldung für Lager-Scanstationen
          </p>
        </form>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { useRouter }   from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router   = useRouter()
const auth     = useAuthStore()

const mode      = ref('password')
const username  = ref('')
const password  = ref('')
const code      = ref('')
const pin       = ref('')
const loading   = ref(false)
const error     = ref('')
const codeInput = ref(null)
const pinInput  = ref(null)

const canSubmitCode = computed(() =>
  !loading.value && code.value.trim().length >= 2 && pin.value.length === 5
)

function switchMode(next) {
  mode.value  = next
  error.value = ''
  code.value  = ''
  pin.value   = ''
  if (next === 'code') nextTick(() => codeInput.value?.focus())
}

function focusPin() {
  if (code.value.trim().length >= 2) nextTick(() => pinInput.value?.focus())
}

async function handleLogin() {
  if (!username.value.trim() || !password.value) return
  loading.value = true
  error.value   = ''
  try {
    await auth.login(username.value.trim(), password.value)
    router.push('/')
  } catch (err) {
    error.value = err.response?.data?.error ?? 'Anmeldung fehlgeschlagen'
    password.value = ''
  } finally {
    loading.value = false
  }
}

async function handleCodeLogin() {
  if (!canSubmitCode.value) return
  loading.value = true
  error.value   = ''
  try {
    await auth.loginCode(code.value.trim(), pin.value)
    router.push('/')
  } catch (err) {
    error.value = err.response?.data?.error ?? 'Ungültiges Kürzel oder PIN'
    pin.value = ''
    nextTick(() => pinInput.value?.focus())
  } finally {
    loading.value = false
  }
}
</script>
