<template>
  <div class="flex h-screen overflow-hidden">

    <!-- ── Sidebar overlay (iPad collapsed state) ────────────────────────────── -->
    <div
      v-if="sidebarOpen && isNarrow"
      class="fixed inset-0 z-20"
      style="background: rgba(0,0,0,.5);"
      @click="sidebarOpen = false"
    />

    <!-- ── Sidebar ───────────────────────────────────────────────────────────── -->
    <aside
      class="flex-shrink-0 flex flex-col z-30 transition-all duration-200"
      :class="sidebarOpen ? 'w-48' : 'w-0 overflow-hidden'"
      :style="`background: var(--nav); border-right: 1px solid var(--border);
               ${isNarrow ? 'position:fixed;top:0;left:0;height:100%;' : 'position:relative;'}`"
    >
      <!-- Brand -->
      <div class="px-5 py-4 flex-shrink-0" style="border-bottom: 1px solid var(--border);">
        <span class="block font-semibold text-base" style="color: var(--accent);">AVAtar</span>
        <span class="block text-xs mt-0.5" style="color: var(--muted);">Lagerverwaltung</span>
      </div>

      <!-- Navigation — 44 px tap height on every item -->
      <nav class="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        <RouterLink
          v-for="item in visibleNav"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-2.5 px-3 rounded-lg text-sm font-medium transition-colors"
          style="min-height: 44px;"
          :style="isActive(item.to)
            ? 'background: rgba(0,143,208,.15); color: var(--accent);'
            : 'color: var(--muted);'"
          @click="isNarrow && (sidebarOpen = false)"
        >
          {{ item.label }}
        </RouterLink>
      </nav>

      <!-- User footer -->
      <div class="px-4 py-3 flex-shrink-0" style="border-top: 1px solid var(--border);">
        <p class="text-xs font-medium truncate" style="color: var(--text);">{{ auth.user?.username }}</p>
        <p class="text-xs mt-0.5" style="color: var(--muted);">{{ auth.roleLabel }}</p>
        <!-- Logout — full-width tap area, 44 px -->
        <button
          class="mt-2 w-full flex items-center text-xs rounded-lg px-0 transition-colors"
          style="min-height: 36px; color: var(--muted);"
          @click="auth.logout()"
        >
          Abmelden
        </button>
      </div>
    </aside>

    <!-- ── Main ──────────────────────────────────────────────────────────────── -->
    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">

      <!-- Top bar — hamburger on iPad, nothing on desktop -->
      <header
        v-if="isNarrow"
        class="flex-shrink-0 flex items-center gap-3 px-4"
        style="height:52px; background:var(--nav); border-bottom:1px solid var(--border);"
      >
        <button
          class="flex items-center justify-center rounded-lg"
          style="width:40px;height:40px;color:var(--text);"
          @click="sidebarOpen = !sidebarOpen"
          aria-label="Menü"
        >
          <!-- hamburger icon -->
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect y="4"  width="20" height="2" rx="1" fill="currentColor"/>
            <rect y="9"  width="20" height="2" rx="1" fill="currentColor"/>
            <rect y="14" width="20" height="2" rx="1" fill="currentColor"/>
          </svg>
        </button>
        <span class="font-semibold text-sm" style="color: var(--accent);">AVAtar</span>
      </header>

      <main class="flex-1 overflow-y-auto" style="background: var(--bg);">
        <slot />
      </main>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute }     from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth  = useAuthStore()
const route = useRoute()

// ── Responsive sidebar ────────────────────────────────────────────────────────
const windowWidth  = ref(window.innerWidth)
const isNarrow     = computed(() => windowWidth.value < 1024)   // below lg = iPad
const sidebarOpen  = ref(!isNarrow.value)                       // open by default on desktop

function onResize() {
  windowWidth.value = window.innerWidth
  if (!isNarrow.value) sidebarOpen.value = true
}

onMounted(()  => window.addEventListener('resize', onResize))
onUnmounted(() => window.removeEventListener('resize', onResize))

// ── Navigation ────────────────────────────────────────────────────────────────
const NAV = [
  { to: '/dashboard',     label: 'Dashboard',     minRole: 'staff'             },
  { to: '/scan',          label: 'Scannen',        minRole: 'staff'             },
  { to: '/buchen',        label: 'Warenkorb',      minRole: 'staff'             },
  { to: '/artikel',       label: 'Artikel',        minRole: 'staff'             },
  { to: '/verleihe',      label: 'Verleihe',       minRole: 'warehouse_manager' },
  { to: '/kategorien',    label: 'Kategorien',     minRole: 'warehouse_manager' },
  { to: '/lieferanten',   label: 'Lieferanten',    minRole: 'warehouse_manager' },
  { to: '/benutzer',      label: 'Benutzer',       minRole: 'admin'             },
  { to: '/einstellungen', label: 'Einstellungen',  minRole: 'admin'             },
]

const visibleNav = computed(() =>
  NAV.filter(item => auth.hasMinRole(item.minRole))
)

function isActive(to) {
  return route.path === to || route.path.startsWith(to + '/')
}
</script>
