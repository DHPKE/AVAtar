<template>
  <StaffLayout>
    <div class="px-4 pt-5 pb-6 max-w-sm mx-auto">

      <!-- User info -->
      <div class="rounded-xl px-5 py-4 mb-6" style="background: var(--card); border: 1px solid var(--border);">
        <div class="w-14 h-14 rounded-full flex items-center justify-center mb-3"
          style="background: rgba(0,143,208,.15);">
          <span class="text-xl font-bold" style="color: var(--accent);">
            {{ auth.user?.username?.charAt(0).toUpperCase() }}
          </span>
        </div>
        <p class="text-base font-semibold" style="color: var(--text);">{{ auth.user?.username }}</p>
        <p class="text-sm mt-0.5" style="color: var(--muted);">{{ auth.roleLabel }}</p>
      </div>

      <!-- Change password -->
      <div class="rounded-xl px-5 py-5 mb-4" style="background: var(--card); border: 1px solid var(--border);">
        <h2 class="text-sm font-semibold mb-4" style="color: var(--text);">Passwort ändern</h2>

        <div class="flex flex-col gap-3">
          <input
            v-model="currentPw"
            type="password"
            placeholder="Aktuelles Passwort"
            class="w-full rounded-xl px-4 text-sm"
            style="height:52px; background:var(--surface); border:1.5px solid var(--border); color:var(--text); outline:none;"
            @focus="e => e.target.style.borderColor='var(--accent)'"
            @blur="e  => e.target.style.borderColor='var(--border)'"
          />
          <input
            v-model="newPw"
            type="password"
            placeholder="Neues Passwort (min. 8 Zeichen)"
            class="w-full rounded-xl px-4 text-sm"
            style="height:52px; background:var(--surface); border:1.5px solid var(--border); color:var(--text); outline:none;"
            @focus="e => e.target.style.borderColor='var(--accent)'"
            @blur="e  => e.target.style.borderColor='var(--border)'"
          />
        </div>

        <div v-if="pwError" class="mt-3 text-xs rounded-lg px-3 py-2" style="background:rgba(239,68,68,.12);color:var(--error);">
          {{ pwError }}
        </div>
        <div v-if="pwSuccess" class="mt-3 text-xs rounded-lg px-3 py-2" style="background:rgba(34,197,94,.12);color:#22C55E;">
          Passwort erfolgreich geändert
        </div>

        <button
          class="mt-4 w-full rounded-xl text-sm font-semibold active:opacity-70 transition-opacity"
          style="height:52px; background:var(--accent); color:#fff;"
          :style="!canChangePw ? 'opacity:.4' : ''"
          :disabled="!canChangePw || pwLoading"
          @click="changePassword"
        >
          {{ pwLoading ? 'Wird geändert…' : 'Passwort ändern' }}
        </button>
      </div>

      <!-- Change PIN -->
      <div class="rounded-xl px-5 py-5 mb-4" style="background: var(--card); border: 1px solid var(--border);">
        <h2 class="text-sm font-semibold mb-1" style="color: var(--text);">Kürzel-PIN ändern</h2>

        <p v-if="!auth.user?.shortcode" class="text-xs mt-2" style="color: var(--muted);">
          Noch kein Kürzel hinterlegt — bitte vom Administrator vergeben lassen, bevor eine PIN gesetzt werden kann.
        </p>

        <template v-else>
          <p class="text-xs mb-4" style="color: var(--muted);">Kürzel: {{ auth.user.shortcode }}</p>

          <input
            v-model="pinCurrentPw"
            type="password"
            placeholder="Aktuelles Passwort zur Bestätigung"
            class="w-full rounded-xl px-4 text-sm mb-3"
            style="height:52px; background:var(--surface); border:1.5px solid var(--border); color:var(--text); outline:none;"
            @focus="e => e.target.style.borderColor='var(--accent)'"
            @blur="e  => e.target.style.borderColor='var(--border)'"
          />

          <p class="block text-xs mb-2 font-medium text-center" style="color: var(--muted);">Neue PIN</p>
          <input
            :value="'•'.repeat(newPin.length)"
            type="text"
            readonly
            placeholder="• • • • •"
            class="w-full text-center font-bold tracking-[0.3em] rounded-2xl px-2 mb-3"
            style="height: 72px; font-size: 1.75rem; background: var(--surface); color: var(--text); outline: none; border:3px solid var(--border);"
          />

          <OnScreenNumpad
            :allow-decimal="false"
            enter-label="PIN ändern"
            :enter-disabled="!canChangePin || pinLoading"
            @digit="appendNewPinDigit"
            @backspace="newPin = newPin.slice(0, -1)"
            @enter="changePin"
          />

          <div v-if="pinError" class="mt-3 text-xs rounded-lg px-3 py-2" style="background:rgba(239,68,68,.12);color:var(--error);">
            {{ pinError }}
          </div>
          <div v-if="pinSuccess" class="mt-3 text-xs rounded-lg px-3 py-2" style="background:rgba(34,197,94,.12);color:#22C55E;">
            PIN erfolgreich geändert
          </div>
        </template>
      </div>

      <!-- Logout -->
      <button
        class="w-full rounded-xl text-sm font-semibold active:opacity-70 transition-opacity"
        style="height:56px; background:var(--surface); border:1.5px solid var(--border); color:var(--error);"
        @click="auth.logout()"
      >
        Abmelden
      </button>

    </div>
  </StaffLayout>
</template>

<script setup>
import { ref, computed } from 'vue'
import StaffLayout from '@/components/StaffLayout.vue'
import OnScreenNumpad from '@/components/OnScreenNumpad.vue'
import { useAuthStore } from '@/stores/auth'

const auth      = useAuthStore()
const currentPw = ref('')
const newPw     = ref('')
const pwLoading = ref(false)
const pwError   = ref('')
const pwSuccess = ref(false)

const canChangePw = computed(() => currentPw.value.length > 0 && newPw.value.length >= 8)

const pinCurrentPw = ref('')
const newPin        = ref('')
const pinLoading     = ref(false)
const pinError       = ref('')
const pinSuccess     = ref(false)

const canChangePin = computed(() => pinCurrentPw.value.length > 0 && newPin.value.length === 5)

function appendNewPinDigit(d) {
  if (newPin.value.length < 5) newPin.value += d
}

async function changePassword() {
  pwLoading.value = true
  pwError.value   = ''
  pwSuccess.value = false
  try {
    await auth.changePassword(currentPw.value, newPw.value)
    pwSuccess.value = true
    currentPw.value = ''
    newPw.value     = ''
  } catch (err) {
    pwError.value = err.response?.data?.error ?? 'Fehler beim Ändern'
  } finally {
    pwLoading.value = false
  }
}

async function changePin() {
  if (!canChangePin.value) return
  pinLoading.value = true
  pinError.value   = ''
  pinSuccess.value = false
  try {
    await auth.changePin(pinCurrentPw.value, newPin.value)
    pinSuccess.value = true
    pinCurrentPw.value = ''
    newPin.value       = ''
  } catch (err) {
    pinError.value = err.response?.data?.error ?? 'Fehler beim Ändern'
  } finally {
    pinLoading.value = false
  }
}
</script>
