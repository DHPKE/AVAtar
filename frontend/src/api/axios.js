import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 15_000,
})

// ── Request: attach stored JWT ────────────────────────────────────────────────
api.interceptors.request.use(config => {
  const token = localStorage.getItem('avatar_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Response: handle auth errors + normalise error shape ─────────────────────
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('avatar_token')
      localStorage.removeItem('avatar_user')
      // Hard redirect so the router/store state is fully reset
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api
