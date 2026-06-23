import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  // ── Root: role-aware redirect ───────────────────────────────────────────────
  {
    path:      '/',
    name:      'Home',
    component: () => import('@/views/HomeRedirectView.vue'),
    meta:      { requiresAuth: true },
  },

  // ── Public ──────────────────────────────────────────────────────────────────
  {
    path:      '/login',
    name:      'Login',
    component: () => import('@/views/LoginView.vue'),
    meta:      { public: true },
  },

  // ── Shared: scan (layout adapts to role) ────────────────────────────────────
  {
    path:      '/scan',
    name:      'Scan',
    component: () => import('@/views/ScanView.vue'),
    meta:      { requiresAuth: true },
  },
  {
    path:      '/buchen',
    name:      'Booking',
    component: () => import('@/views/BookingView.vue'),
    meta:      { requiresAuth: true },
  },

  // ── Staff bottom-nav routes ──────────────────────────────────────────────────
  {
    path:      '/verlauf',
    name:      'StaffHistory',
    component: () => import('@/views/staff/HistoryView.vue'),
    meta:      { requiresAuth: true },
  },
  {
    path:      '/staff-verleih',
    name:      'StaffRentals',
    component: () => import('@/views/RentalsView.vue'),   // reuses admin view in StaffLayout
    meta:      { requiresAuth: true, minRole: 'warehouse_manager' },
  },
  {
    path:      '/konto',
    name:      'Account',
    component: () => import('@/views/staff/AccountView.vue'),
    meta:      { requiresAuth: true },
  },

  // ── Admin / warehouse_manager (AppLayout) ───────────────────────────────────
  {
    path:      '/dashboard',
    name:      'Dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta:      { requiresAuth: true, minRole: 'warehouse_manager' },
  },
  {
    path:      '/artikel',
    name:      'Articles',
    component: () => import('@/views/ArticlesView.vue'),
    meta:      { requiresAuth: true, minRole: 'warehouse_manager' },
  },
  {
    path:      '/artikel/:id',
    name:      'ArticleDetail',
    component: () => import('@/views/ArticleDetailView.vue'),
    meta:      { requiresAuth: true, minRole: 'warehouse_manager' },
  },
  {
    path:      '/verleihe',
    name:      'Rentals',
    component: () => import('@/views/RentalsView.vue'),
    meta:      { requiresAuth: true, minRole: 'warehouse_manager' },
  },
  {
    path:      '/kategorien',
    name:      'Categories',
    component: () => import('@/views/CategoriesView.vue'),
    meta:      { requiresAuth: true, minRole: 'warehouse_manager' },
  },
  {
    path:      '/gruppen',
    name:      'Groups',
    component: () => import('@/views/GroupsView.vue'),
    meta:      { requiresAuth: true, minRole: 'warehouse_manager' },
  },
  {
    path:      '/inventur',
    name:      'Stocktakes',
    component: () => import('@/views/StocktakesView.vue'),
    meta:      { requiresAuth: true, minRole: 'warehouse_manager' },
  },
  {
    path:      '/inventur/:id',
    name:      'StocktakeDetail',
    component: () => import('@/views/StocktakeDetailView.vue'),
    meta:      { requiresAuth: true, minRole: 'warehouse_manager' },
  },
  {
    path:      '/scanliste',
    name:      'ScanList',
    component: () => import('@/views/ScanListView.vue'),
    meta:      { requiresAuth: true, minRole: 'warehouse_manager' },
  },
  {
    path:      '/lieferanten',
    name:      'Suppliers',
    component: () => import('@/views/SuppliersView.vue'),
    meta:      { requiresAuth: true, minRole: 'warehouse_manager' },
  },
  {
    path:      '/benutzer',
    name:      'Users',
    component: () => import('@/views/UsersView.vue'),
    meta:      { requiresAuth: true, minRole: 'admin' },
  },
  {
    path:      '/einstellungen',
    name:      'Settings',
    component: () => import('@/views/SettingsView.vue'),
    meta:      { requiresAuth: true, minRole: 'admin' },
  },

  // ── Fallback ─────────────────────────────────────────────────────────────────
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// ── Navigation guard ──────────────────────────────────────────────────────────
let sessionRestored = false

router.beforeEach(async (to) => {
  if (to.meta.public) return true

  const auth = useAuthStore()

  if (!sessionRestored) {
    sessionRestored = true
    if (!auth.isAuthenticated) await auth.restoreSession()
  }

  if (!auth.isAuthenticated) return '/login'

  // Role guard
  if (to.meta.minRole && !auth.hasMinRole(to.meta.minRole)) {
    // Staff trying to access admin routes → send to Warenkorb
    return auth.role === 'staff' ? '/buchen' : '/dashboard'
  }

  return true
})

export default router
