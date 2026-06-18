<template>
  <AppLayout>
    <div class="flex flex-col h-full">

      <!-- ── Tab bar ─────────────────────────────────────────────────────────── -->
      <div class="flex-shrink-0 flex items-center gap-1 px-5 py-3"
        style="border-bottom:1px solid var(--border);background:var(--surface);">
        <button v-for="tab in tabs" :key="tab.key"
          class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          :style="activeTab === tab.key
            ? 'background:rgba(0,143,208,.15);color:var(--accent);'
            : 'color:var(--muted);'"
          @click="activeTab = tab.key; fetchRentals()">
          {{ tab.label }}
          <span v-if="tab.count" class="ml-1 text-xs px-1 rounded"
            :style="activeTab === tab.key ? 'background:rgba(0,143,208,.2)' : 'background:var(--card)'">
            {{ tab.count }}
          </span>
        </button>
      </div>

      <!-- ── Table ───────────────────────────────────────────────────────────── -->
      <div class="flex-1 overflow-auto px-5 py-3">
        <div v-if="loading" class="flex justify-center py-16">
          <div class="w-8 h-8 rounded-full border-2 animate-spin" style="border-color:var(--accent);border-top-color:transparent;" />
        </div>

        <div v-else-if="!rentals.length" class="text-sm text-center py-16" style="color:var(--muted);">
          {{ activeTab === 'overdue' ? 'Keine überfälligen Verleihe' : 'Keine Verleihe gefunden' }}
        </div>

        <table v-else class="w-full text-sm" style="border-collapse:collapse;">
          <thead style="position:sticky;top:0;z-index:1;">
            <tr style="background:var(--surface);border-bottom:1px solid var(--border);">
              <th class="text-left py-2 pr-4 font-medium text-xs" style="color:var(--muted);">Artikel</th>
              <th class="text-left py-2 pr-4 font-medium text-xs hidden md:table-cell" style="color:var(--muted);">Seriennr.</th>
              <th class="text-left py-2 pr-4 font-medium text-xs" style="color:var(--muted);">Verliehen an</th>
              <th class="text-left py-2 pr-4 font-medium text-xs hidden lg:table-cell" style="color:var(--muted);">Ausgeliehen</th>
              <th class="text-left py-2 pr-4 font-medium text-xs" style="color:var(--muted);">Rückgabe</th>
              <th v-if="auth.hasMinRole('warehouse_manager')" class="py-2 font-medium text-xs" style="color:var(--muted);"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rentals" :key="r.id"
              style="border-bottom:1px solid var(--border);"
              @mouseover="e => e.currentTarget.style.background='var(--surface)'"
              @mouseleave="e => e.currentTarget.style.background=''">
              <td class="py-2.5 pr-4 font-medium" style="color:var(--text);">{{ r.article_name }}</td>
              <td class="py-2.5 pr-4 font-mono text-xs hidden md:table-cell" style="color:var(--muted);">{{ r.serial_number }}</td>
              <td class="py-2.5 pr-4 text-sm" style="color:var(--text);">{{ r.rented_to }}</td>
              <td class="py-2.5 pr-4 text-xs hidden lg:table-cell" style="color:var(--muted);">{{ fmtDate(r.rented_at) }}</td>
              <td class="py-2.5 pr-4 text-xs">
                <span v-if="r.returned_at" style="color:var(--muted);">{{ fmtDate(r.returned_at) }}</span>
                <span v-else-if="r.is_overdue"
                  class="px-1.5 py-0.5 rounded font-medium"
                  style="background:rgba(239,68,68,.15);color:var(--error);">
                  Überfällig
                </span>
                <span v-else-if="r.expected_return" style="color:var(--muted);">{{ fmtDate(r.expected_return) }}</span>
                <span v-else style="color:var(--muted);">—</span>
              </td>
              <td v-if="auth.hasMinRole('warehouse_manager')" class="py-2.5">
                <button v-if="!r.returned_at"
                  class="px-3 py-1 rounded text-xs font-medium transition-opacity active:opacity-70"
                  style="background:rgba(0,143,208,.15);color:var(--accent);"
                  :disabled="returning === r.id"
                  @click="doReturn(r)">
                  {{ returning === r.id ? '…' : 'Rückgabe' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="flex-shrink-0 flex items-center justify-between px-5 py-2 text-xs"
        style="border-top:1px solid var(--border);color:var(--muted);">
        <span>{{ total }} Einträge</span>
        <div class="flex items-center gap-2">
          <button :disabled="page<=1" @click="page--;fetchRentals()"
            class="px-2 py-1 rounded" :style="page<=1?'opacity:.3':''"
            style="background:var(--card);color:var(--text);">‹</button>
          <span>{{ page }} / {{ Math.max(1, Math.ceil(total/limit)) }}</span>
          <button :disabled="page >= Math.ceil(total/limit)" @click="page++;fetchRentals()"
            class="px-2 py-1 rounded" :style="page>=Math.ceil(total/limit)?'opacity:.3':''"
            style="background:var(--card);color:var(--text);">›</button>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import AppLayout from '@/components/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'
import api from '@/api/axios'
import { fmtDate } from '@/utils/labels.js'

const auth      = useAuthStore()
const rentals   = ref([])
const total     = ref(0)
const loading   = ref(false)
const returning = ref(null)
const page      = ref(1)
const limit     = 50

const overdueCount = ref(0)
const activeCount  = ref(0)
const activeTab    = ref('active')

const tabs = computed(() => [
  { key:'active',  label:'Aktiv',      count: activeCount.value  || null },
  { key:'all',     label:'Alle',       count: null },
  { key:'overdue', label:'Überfällig', count: overdueCount.value || null },
])

async function fetchRentals() {
  loading.value = true
  try {
    const params = new URLSearchParams({ limit, offset: (page.value-1)*limit })
    if (activeTab.value === 'active')  params.set('active', '1')
    if (activeTab.value === 'overdue') params.set('overdue', '1')
    const { data } = await api.get(`/rentals?${params}`)
    rentals.value = data.rentals
    total.value   = data.total
  } finally {
    loading.value = false
  }
}

async function fetchCounts() {
  const [a, o] = await Promise.allSettled([
    api.get('/rentals?active=1&limit=1'),
    api.get('/rentals?overdue=1&limit=1'),
  ])
  if (a.status === 'fulfilled') activeCount.value  = a.value.data.total
  if (o.status === 'fulfilled') overdueCount.value = o.value.data.total
}

async function doReturn(rental) {
  returning.value = rental.id
  try {
    await api.post(`/rentals/${rental.id}/return`, {})
    await fetchRentals()
    fetchCounts()
  } finally {
    returning.value = null
  }
}

onMounted(() => { fetchRentals(); fetchCounts() })
</script>
