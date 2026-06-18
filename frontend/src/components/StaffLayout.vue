<template>
  <div class="flex flex-col" style="height: 100dvh; background: var(--bg);">

    <!-- ── Content ────────────────────────────────────────────────────────────── -->
    <main class="flex-1 overflow-y-auto">
      <slot />
    </main>

    <!-- ── Bottom navigation ──────────────────────────────────────────────────── -->
    <nav
      class="flex-shrink-0 flex"
      style="background: var(--nav); border-top: 1px solid var(--border); padding-bottom: env(safe-area-inset-bottom);"
    >
      <RouterLink
        v-for="tab in visibleTabs"
        :key="tab.to"
        :to="tab.to"
        class="flex-1 flex flex-col items-center justify-center gap-1 transition-colors"
        style="min-height: 64px; -webkit-tap-highlight-color: transparent;"
        :style="isActive(tab.to)
          ? 'color: var(--accent);'
          : 'color: var(--muted);'"
      >
        <component :is="tab.icon" class="w-6 h-6" />
        <span class="text-xs font-medium">{{ tab.label }}</span>
      </RouterLink>
    </nav>

  </div>
</template>

<script setup>
import { computed, h }  from 'vue'
import { useRoute }     from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth  = useAuthStore()
const route = useRoute()

// ── Inline SVG icon components ────────────────────────────────────────────────
const IconScan = {
  render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    h('path', { d: 'M3 7V5a2 2 0 0 1 2-2h2' }),
    h('path', { d: 'M17 3h2a2 2 0 0 1 2 2v2' }),
    h('path', { d: 'M21 17v2a2 2 0 0 1-2 2h-2' }),
    h('path', { d: 'M7 21H5a2 2 0 0 1-2-2v-2' }),
    h('line', { x1: '7', y1: '12', x2: '17', y2: '12' }),
    h('line', { x1: '12', y1: '7', x2: '12', y2: '17' }),
  ]),
}

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

const TABS = [
  { to: '/scan',         label: 'Scannen',  icon: IconScan,    minRole: 'staff'             },
  { to: '/verlauf',      label: 'Verlauf',  icon: IconHistory, minRole: 'staff'             },
  { to: '/staff-verleih',label: 'Verleih',  icon: IconRental,  minRole: 'warehouse_manager' },
  { to: '/konto',        label: 'Konto',    icon: IconAccount, minRole: 'staff'             },
]

const visibleTabs = computed(() =>
  TABS.filter(tab => auth.hasMinRole(tab.minRole))
)

function isActive(to) {
  return route.path === to || route.path.startsWith(to + '/')
}
</script>
