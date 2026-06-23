<template>
  <div class="flex flex-col" style="height: 100dvh; background: var(--bg);">

    <!-- ── Content ────────────────────────────────────────────────────────────── -->
    <main class="flex-1 overflow-y-auto">
      <slot />
    </main>

    <!-- ── Bottom navigation ──────────────────────────────────────────────────── -->
    <nav
      class="flex-shrink-0 flex"
      style="background: var(--nav); border-top: 1px solid var(--border);"
    >
      <RouterLink
        v-for="tab in visibleTabs"
        :key="tab.to"
        :to="tab.to"
        class="flex-1 flex flex-col items-center justify-center gap-1 transition-colors relative"
        style="min-height: 64px; -webkit-tap-highlight-color: transparent;"
        :style="isActive(tab.to)
          ? 'color: var(--accent);'
          : 'color: var(--muted);'"
      >
        <span v-if="tab.badge && cart.count" class="absolute top-1.5 right-1/4 flex items-center justify-center text-xs font-bold rounded-full"
          style="min-width:16px;height:16px;background:var(--accent);color:#fff;font-size:10px;padding:0 4px;">
          {{ cart.count }}
        </span>
        <component :is="tab.icon" class="w-6 h-6" />
        <span class="text-xs font-medium">{{ tab.label }}</span>
      </RouterLink>
    </nav>

    <!-- ── Abmelden ──────────────────────────────────────────────────────────── -->
    <button
      type="button"
      class="flex-shrink-0 w-full font-semibold text-sm transition-colors select-none"
      style="height:48px; background:var(--nav); border-top:1px solid var(--border); color:var(--error); -webkit-tap-highlight-color:transparent; touch-action:manipulation; padding-bottom: env(safe-area-inset-bottom);"
      @click="auth.logout()"
    >
      Abmelden
    </button>

  </div>
</template>

<script setup>
import { computed, h }  from 'vue'
import { useRoute }     from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'

const auth  = useAuthStore()
const cart  = useCartStore()
const route = useRoute()

// ── Inline SVG icon components ────────────────────────────────────────────────
const IconHistory = {
  render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    h('circle', { cx: '12', cy: '12', r: '9' }),
    h('polyline', { points: '12 7 12 12 15 15' }),
  ]),
}

const IconRental = {
  render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    h('rect', { x: '1', y: '3', width: '15', height: '13', rx: '1' }),
    h('path', { d: 'M16 8h4l3 4v3h-7V8z' }),
    h('circle', { cx: '5.5', cy: '18.5', r: '2.5' }),
    h('circle', { cx: '18.5', cy: '18.5', r: '2.5' }),
  ]),
}

const IconAccount = {
  render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    h('circle', { cx: '12', cy: '8', r: '4' }),
    h('path', { d: 'M4 20c0-4 3.6-7 8-7s8 3 8 7' }),
  ]),
}

const IconCart = {
  render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    h('circle', { cx: '9',  cy: '20', r: '1.4' }),
    h('circle', { cx: '18', cy: '20', r: '1.4' }),
    h('path', { d: 'M2.5 3h2l2.8 12.4a2 2 0 0 0 2 1.6h7.4a2 2 0 0 0 2-1.6L21 7H6' }),
  ]),
}

const TABS = [
  { to: '/buchen',        label: 'Buchen',         icon: IconCart,    minRole: 'staff', badge: true },
  { to: '/verlauf',       label: 'Verlauf',        icon: IconHistory, minRole: 'staff'             },
  { to: '/staff-verleih', label: 'Geräteverleih',  icon: IconRental,  minRole: 'warehouse_manager' },
  { to: '/konto',         label: 'Konto',          icon: IconAccount, minRole: 'staff'             },
]

const visibleTabs = computed(() =>
  TABS.filter(tab => auth.hasMinRole(tab.minRole))
)

function isActive(to) {
  return route.path === to || route.path.startsWith(to + '/')
}
</script>
