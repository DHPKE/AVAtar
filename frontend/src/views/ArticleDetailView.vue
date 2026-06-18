<template>
  <AppLayout>
    <div class="p-5 max-w-5xl mx-auto">

      <div v-if="loading" class="flex justify-center py-16">
        <div class="w-8 h-8 rounded-full border-2 animate-spin" style="border-color:var(--accent);border-top-color:transparent;" />
      </div>

      <template v-else-if="article">
        <!-- Header -->
        <div class="flex items-center gap-3 mb-5">
          <button @click="$router.back()" class="text-sm" style="color:var(--muted);">← Zurück</button>
          <span class="font-mono text-sm" style="color:var(--muted);">{{ article.article_number }}</span>
          <span class="inline-flex items-center text-xs px-2 py-0.5 rounded font-medium"
            :style="`background:${TYPE_META[article.type]?.bg};color:${TYPE_META[article.type]?.color};`">
            {{ TYPE_META[article.type]?.label }}
          </span>
          <button v-if="auth.hasMinRole('warehouse_manager')" @click="editPanel = true"
            class="ml-auto text-xs px-3 py-1.5 rounded-lg" style="background:var(--card);border:1px solid var(--border);color:var(--text);">
            Bearbeiten
          </button>
          <a :href="`/api/articles/${article.id}/qrcode.svg`" target="_blank" download
            class="text-xs px-3 py-1.5 rounded-lg" style="background:var(--card);border:1px solid var(--border);color:var(--text);">
            QR-Code
          </a>
        </div>

        <!-- Info + Stock grid -->
        <div class="grid gap-4 mb-5 lg:grid-cols-3">
          <!-- Info card -->
          <div class="lg:col-span-2 rounded-xl p-4" style="background:var(--card);border:1px solid var(--border);">
            <h1 class="text-xl font-semibold mb-3" style="color:var(--text);">{{ article.name }}</h1>
            <p v-if="article.description" class="text-sm mb-4" style="color:var(--muted);">{{ article.description }}</p>
            <div class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div v-for="row in infoRows" :key="row.label">
                <span class="text-xs" style="color:var(--muted);">{{ row.label }}</span>
                <p class="font-medium" style="color:var(--text);">{{ row.value }}</p>
              </div>
            </div>
          </div>

          <!-- Stock card -->
          <div class="rounded-xl p-4 flex flex-col justify-between" style="background:var(--card);border:1px solid var(--border);">
            <div>
              <p class="text-xs mb-1" style="color:var(--muted);">Aktueller Bestand</p>
              <p class="text-5xl font-bold" :style="`color:${stockColor}`">{{ fmtStock(article) }}</p>
              <p class="text-xs mt-1" style="color:var(--muted);">Minimum: {{ article.unit === 'meter' ? article.min_stock + ' m' : article.min_stock + ' Stk' }}</p>
            </div>
            <button v-if="auth.hasMinRole('warehouse_manager')"
              @click="$router.push('/scan')"
              class="mt-4 w-full rounded-lg text-sm font-medium"
              style="height:40px;background:var(--accent);color:#fff;">
              Buchung vornehmen
            </button>
          </div>
        </div>

        <!-- Serial numbers (equipment/rental) -->
        <div v-if="serials.length" class="rounded-xl p-4 mb-5" style="background:var(--card);border:1px solid var(--border);">
          <p class="text-sm font-semibold mb-3" style="color:var(--text);">Seriennummern ({{ serials.length }})</p>
          <div class="flex flex-wrap gap-2">
            <span v-for="sn in serials" :key="sn.id"
              class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono"
              style="background:var(--surface);border:1px solid var(--border);">
              <span style="color:var(--text);">{{ sn.serial_number }}</span>
              <span class="px-1.5 py-0.5 rounded text-xs font-sans font-medium"
                :style="`background:${SN_STATUS[sn.status]?.bg};color:${SN_STATUS[sn.status]?.color};`">
                {{ SN_STATUS[sn.status]?.label ?? sn.status }}
              </span>
            </span>
          </div>
        </div>

        <!-- Movement history -->
        <div class="rounded-xl p-4" style="background:var(--card);border:1px solid var(--border);">
          <p class="text-sm font-semibold mb-3" style="color:var(--text);">Bewegungshistorie</p>
          <div v-if="movLoading" class="flex justify-center py-6">
            <div class="w-6 h-6 rounded-full border-2 animate-spin" style="border-color:var(--accent);border-top-color:transparent;" />
          </div>
          <div v-else-if="!movements.length" class="text-sm text-center py-6" style="color:var(--muted);">Noch keine Buchungen</div>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-xs" style="border-collapse:collapse;">
              <thead>
                <tr style="border-bottom:1px solid var(--border);">
                  <th class="text-left py-2 pr-4 font-medium" style="color:var(--muted);">Typ</th>
                  <th class="text-right py-2 pr-4 font-medium" style="color:var(--muted);">Menge</th>
                  <th class="text-left py-2 pr-4 font-medium hidden sm:table-cell" style="color:var(--muted);">Referenz</th>
                  <th class="text-left py-2 pr-4 font-medium hidden sm:table-cell" style="color:var(--muted);">Benutzer</th>
                  <th class="text-left py-2 font-medium" style="color:var(--muted);">Datum</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in movements" :key="m.id" style="border-bottom:1px solid var(--border);">
                  <td class="py-2 pr-4">
                    <span class="px-1.5 py-0.5 rounded font-medium"
                      :style="`background:${MOVEMENT_META[m.type]?.bg};color:${MOVEMENT_META[m.type]?.color};`">
                      {{ MOVEMENT_META[m.type]?.label }}
                    </span>
                  </td>
                  <td class="py-2 pr-4 text-right font-semibold" style="color:var(--text);">
                    {{ m.article_unit === 'meter' ? m.meters + ' m' : m.qty + ' Stk' }}
                  </td>
                  <td class="py-2 pr-4 hidden sm:table-cell" style="color:var(--muted);">{{ m.reference || '—' }}</td>
                  <td class="py-2 pr-4 hidden sm:table-cell" style="color:var(--muted);">{{ m.created_by_username }}</td>
                  <td class="py-2" style="color:var(--muted);">{{ fmtDateTime(m.created_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>

    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'
import api from '@/api/axios'
import { TYPE_META, MOVEMENT_META, fmtStock, fmtDate, fmtDateTime, isLowStock } from '@/utils/labels.js'

const auth    = useAuthStore()
const route   = useRoute()
const loading = ref(true)
const movLoading = ref(true)
const article = ref(null)
const serials = ref([])
const movements = ref([])
const editPanel = ref(false)

const SN_STATUS = {
  available:   { label:'Verfügbar', color:'#22C55E', bg:'rgba(34,197,94,.15)'  },
  rented:      { label:'Verliehen', color:'#14B8A6', bg:'rgba(20,184,166,.15)' },
  maintenance: { label:'Wartung',   color:'#F59E0B', bg:'rgba(245,158,11,.15)' },
  retired:     { label:'Ausgemus.', color:'#6B7280', bg:'rgba(107,114,128,.15)' },
}

const stockColor = computed(() => {
  if (!article.value) return 'var(--text)'
  return isLowStock(article.value) ? 'var(--error)' : '#22C55E'
})

const infoRows = computed(() => {
  if (!article.value) return []
  return [
    { label: 'Kategorie',   value: article.value.category_name || '—' },
    { label: 'Lieferant',   value: article.value.supplier_name || '—' },
    { label: 'Lagerort',    value: article.value.location      || '—' },
    { label: 'Barcode',     value: article.value.barcode       || '—' },
    { label: 'Einkaufspreis', value: article.value.purchase_price != null ? `€ ${article.value.purchase_price}` : '—' },
    { label: 'Angelegt am', value: fmtDate(article.value.created_at) },
  ]
})

onMounted(async () => {
  const id = route.params.id
  try {
    const { data } = await api.get(`/articles/${id}`)
    article.value = data
    serials.value = data.serials ?? []
  } finally {
    loading.value = false
  }
  try {
    const { data } = await api.get(`/movements/article/${id}?limit=100`)
    movements.value = data.movements
  } finally {
    movLoading.value = false
  }
})
</script>
