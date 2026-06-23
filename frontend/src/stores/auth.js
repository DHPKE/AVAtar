import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/axios'

const ROLE_HIERARCHY = ['staff', 'warehouse_manager', 'admin']

export const useAuthStore = defineStore('auth', () => {
  // ── State ───────────────────────────────────────────────────────────────────
  const token = ref(localStorage.getItem('avatar_token') ?? null)
  const user  = ref(
    JSON.parse(localStorage.getItem('avatar_user') ?? 'null')
  )

  // ── Getters ─────────────────────────────────────────────────────────────────
  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const role            = computed(() => user.value?.role ?? null)

  const roleLabel = computed(() => ({
    admin:             'Administrator',
    warehouse_manager: 'Lagerverwalter',
    staff:             'Mitarbeiter',
  }[role.value] ?? role.value ?? ''))

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function hasMinRole(minRole) {
    return ROLE_HIERARCHY.indexOf(role.value) >= ROLE_HIERARCHY.indexOf(minRole)
  }

  // ── Mutations ────────────────────────────────────────────────────────────────
  function _persist(newToken, newUser) {
    token.value = newToken
    user.value  = newUser
    localStorage.setItem('avatar_token', newToken)
    localStorage.setItem('avatar_user', JSON.stringify(newUser))
  }

  function _clear() {
    token.value = null
    user.value  = null
    localStorage.removeItem('avatar_token')
    localStorage.removeItem('avatar_user')
  }

  // ── Actions ──────────────────────────────────────────────────────────────────
  async function login(username, password) {
    const { data } = await api.post('/auth/login', { username, password })
    _persist(data.token, data.user)
    return data.user
  }

  /** Quick login via Kürzel (short code) + 5-digit PIN — for shared booking stations */
  async function loginCode(code, pin) {
    const { data } = await api.post('/auth/login-code', { code, pin })
    _persist(data.token, data.user)
    return data.user
  }

  function logout() {
    _clear()
    // Full page reload clears all component/store state cleanly
    window.location.href = '/login'
  }

  /**
   * Called on app startup — tries to restore session from stored token.
   * Returns true if session is valid, false if token is missing/expired.
   */
  async function restoreSession() {
    if (!token.value) return false
    try {
      const { data } = await api.get('/auth/me')
      user.value = data.user
      return true
    } catch {
      _clear()
      return false
    }
  }

  async function changePassword(currentPassword, newPassword) {
    await api.post('/auth/change-password', { currentPassword, newPassword })
  }

  async function changePin(currentPassword, newPin) {
    await api.post('/auth/change-pin', { currentPassword, newPin })
  }

  return {
    token, user,
    isAuthenticated, role, roleLabel,
    hasMinRole,
    login, loginCode, logout, restoreSession, changePassword, changePin,
  }
})
