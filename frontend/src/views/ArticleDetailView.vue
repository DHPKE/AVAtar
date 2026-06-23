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
          <button v-if="auth.hasMinRole('warehouse_manager')" @click="openEdit"
            class="ml-auto text-xs px-3 py-1.5 rounded-lg" style="background:var(--card);border:1px solid var(--border);color:var(--text);">
            Bearbeiten
          </button>
          <button @click="downloadQrCode"
            class="text-xs px-3 py-1.5 rounded-lg" style="background:var(--card);border:1px solid var(--border);color:var(--text);">
            QR-Code
          </button>
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
              @click="$router.push('/buchen')"
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

    <!-- ── Edit panel ────────────────────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="editPanel" class="fixed inset-0 z-40 flex justify-end">
        <div class="flex-1 bg-black/50" @click="editPanel = false" />
        <div class="w-full max-w-sm flex flex-col" style="background:var(--surface);border-left:1px solid var(--border);">
          <div class="flex items-center justify-between px-5 py-4 flex-shrink-0" style="border-bottom:1px solid var(--border);">
            <h2 class="font-semibold" style="color:var(--text);">Artikel bearbeiten</h2>
            <button class="text-xl leading-none" style="color:var(--muted);" @click="editPanel = false">×</button>
          </div>

          <div class="flex-1 overflow-y-auto px-5 py-4">
            <form @submit.prevent="saveEdit" class="flex flex-col gap-4">

              <div v-for="field in editFormFields" :key="field.key">
                <label class="block text-xs font-medium mb-1" style="color:var(--muted);">
                  {{ field.label }}<span v-if="field.required" style="color:var(--error);"> *</span>
                </label>

                <select v-if="field.type === 'select'" v-model="editForm[field.key]"
                  class="w-full rounded-lg px-3 text-sm"
                  style="height:40px;background:var(--card);border:1px solid var(--border);color:var(--text);outline:none;">
                  <option v-if="!field.required" value="">— keine —</option>
                  <option v-for="opt in field.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>

                <input v-else v-model="editForm[field.key]" :type="field.inputType || 'text'"
                  :placeholder="field.placeholder || ''"
                  :step="field.step"
                  class="w-full rounded-lg px-3 text-sm"
                  style="height:40px;background:var(--card);border:1px solid var(--border);color:var(--text);outline:none;" />
              </div>

              <div v-if="editError" class="rounded-lg px-3 py-2 text-xs" style="background:rgba(239,68,68,.12);color:var(--error);">{{ editError }}</div>

              <button type="submit"
                class="w-full rounded-lg font-semibold text-sm mt-2"
                style="height:44px;background:var(--accent);color:#fff;"
                :style="editSaving ? 'opacity:.6' : ''"
                :disabled="editSaving">
                {{ editSaving ? 'Wird gespeichert…' : 'Speichern' }}
              </button>
            </form>
          </div>
        </div>
      </div>
    </Teleport>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'
import api from '@/api/axios'
import { TYPE_META, VALID_TYPES, MOVEMENT_META, fmtStock, fmtDate, fmtDateTime, isLowStock } from '@/utils/labels.js'

const auth    = useAuthStore()
const route   = useRoute()
const loading = ref(true)
const movLoading = ref(true)
const article = ref(null)
const serials = ref([])
const movements = ref([])
const editPanel  = ref(false)
const editSaving = ref(false)
const editError  = ref('')
const editForm   = ref({})
const categories = ref([])
const groups     = ref([])
const suppliers  = ref([])

const editFormFields = computed(() => {
  const t = editForm.value.type
  const fields = [
    { key:'name',           label:'Bezeichnung',   required:true },
    { key:'type',           label:'Typ',            required:true, type:'select', options: VALID_TYPES.map(v => ({ value:v, label:TYPE_META[v].label })) },
    { key:'barcode',        label:'Barcode / EAN',  placeholder:'optional' },
    { key:'manufacturer',   label:'Hersteller',     placeholder:'optional' },
    { key:'model_type',     label:'Typ (Modell)',   placeholder:'optional' },
    { key:'category_id',    label:'Kategorie',      type:'select', options: categories.value.map(c => ({ value:c.id, label:c.name })) },
    { key:'group_id',       label:'Gruppe',         type:'select', options: groups.value.map(g => ({ value:g.id, label:g.name })) },
    { key:'supplier_id',    label:'Lieferant',      type:'select', options: suppliers.value.map(s => ({ value:s.id, label:s.name })) },
    { key:'purchase_price', label:'Einkaufspreis',  inputType:'number', step:'0.01', placeholder:'€' },
    { key:'min_stock',      label:t === 'cable' ? 'Mindestbestand (m)' : 'Mindestbestand (Stk)', inputType:'number', step: t === 'cable' ? '0.5' : '1' },
  ]
  if (t === 'bundle') fields.push({ key:'bundle_size', label:'Stück pro Gebinde', inputType:'number', step:'1' })
  fields.push(
    { key:'location_row',   label:'Lagerort — Reihe', placeholder:'optional' },
    { key:'location_shelf', label:'Lagerort — Regal', placeholder:'optional' },
    { key:'location_bin',   label:'Lagerort — Fach',  placeholder:'optional' },
  )
  return fields
})

function openEdit() {
  editForm.value = {
    ...article.value,
    category_id: article.value.category_id ?? '',
    group_id:    article.value.group_id    ?? '',
    supplier_id: article.value.supplier_id ?? '',
  }
  editError.value = ''
  editPanel.value = true
}

async function downloadQrCode() {
  const { data } = await api.get(`/articles/${article.value.id}/qrcode.svg`, { responseType: 'blob' })
  const url = URL.createObjectURL(data)
  const a   = document.createElement('a')
  a.href     = url
  a.download = `qr-${article.value.article_number}.svg`
  a.click()
  URL.revokeObjectURL(url)
}

async function saveEdit() {
  editSaving.value = true
  editError.value  = ''
  try {
    const { data } = await api.put(`/articles/${article.value.id}`, editForm.value)
    article.value   = { ...article.value, ...data.article }
    editPanel.value = false
  } catch (err) {
    editError.value = err.response?.data?.error ?? 'Fehler beim Speichern'
  } finally {
    editSaving.value = false
  }
}

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
    { label: 'Hersteller',  value: article.value.manufacturer  || '—' },
    { label: 'Typ (Modell)', value: article.value.model_type   || '—' },
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
  const [{ data: catData }, { data: grpData }, { data: supData }] = await Promise.all([
    api.get('/categories'),
    api.get('/groups'),
    api.get('/suppliers'),
  ])
  categories.value = catData.categories
  groups.value     = grpData.groups
  suppliers.value  = supData.suppliers
})
</script>
