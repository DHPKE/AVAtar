<template>
  <AppLayout>
    <div class="flex flex-col h-full">

      <!-- ── Filter bar ──────────────────────────────────────────────────────── -->
      <div class="flex-shrink-0 flex flex-wrap items-center gap-2 px-5 py-3"
        style="border-bottom:1px solid var(--border);background:var(--surface);">

        <input v-model="search" type="search" placeholder="Suche…"
          class="rounded-lg px-3 text-sm flex-1 min-w-32"
          style="height:36px;background:var(--card);border:1px solid var(--border);color:var(--text);outline:none;"
          @input="debounceFetch" />

        <select v-model="filterType" @change="fetchArticles"
          class="rounded-lg px-2 text-sm"
          style="height:36px;background:var(--card);border:1px solid var(--border);color:var(--text);outline:none;">
          <option value="">Alle Typen</option>
          <option v-for="t in VALID_TYPES" :key="t" :value="t">{{ TYPE_META[t].label }}</option>
        </select>

        <select v-model="filterCategory" @change="fetchArticles"
          class="rounded-lg px-2 text-sm"
          style="height:36px;background:var(--card);border:1px solid var(--border);color:var(--text);outline:none;">
          <option value="">Alle Kategorien</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>

        <label class="flex items-center gap-1.5 text-sm cursor-pointer select-none" style="color:var(--muted);">
          <input type="checkbox" v-model="filterLowStock" @change="fetchArticles" class="rounded" />
          Niedrig-Bestand
        </label>

        <button v-if="auth.hasMinRole('warehouse_manager')"
          class="ml-auto rounded-lg px-3 text-sm font-medium flex-shrink-0"
          style="height:36px;background:var(--accent);color:#fff;"
          @click="openCreate">
          + Neuer Artikel
        </button>
        <a href="/api/export/articles.csv" download
          class="rounded-lg px-3 text-sm font-medium flex-shrink-0 flex items-center"
          style="height:36px;background:var(--card);border:1px solid var(--border);color:var(--text);">
          CSV Export
        </a>
      </div>

      <!-- ── Table ───────────────────────────────────────────────────────────── -->
      <div class="flex-1 overflow-auto px-5 py-3">
        <div v-if="loading" class="flex justify-center py-16">
          <div class="w-8 h-8 rounded-full border-2 animate-spin" style="border-color:var(--accent);border-top-color:transparent;" />
        </div>

        <div v-else-if="!articles.length" class="text-sm text-center py-16" style="color:var(--muted);">
          Keine Artikel gefunden
        </div>

        <table v-else class="w-full text-sm" style="border-collapse:collapse;">
          <thead style="position:sticky;top:0;z-index:1;">
            <tr style="background:var(--surface);border-bottom:1px solid var(--border);">
              <th class="text-left py-2 pr-4 font-medium text-xs" style="color:var(--muted);">Art.-Nr.</th>
              <th class="text-left py-2 pr-4 font-medium text-xs" style="color:var(--muted);">Bezeichnung</th>
              <th class="text-left py-2 pr-4 font-medium text-xs hidden lg:table-cell" style="color:var(--muted);">Typ</th>
              <th class="text-right py-2 pr-4 font-medium text-xs" style="color:var(--muted);">Bestand</th>
              <th class="text-left py-2 pr-4 font-medium text-xs hidden lg:table-cell" style="color:var(--muted);">Lagerort</th>
              <th class="text-left py-2 font-medium text-xs hidden xl:table-cell" style="color:var(--muted);">Lieferant</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in articles" :key="a.id"
              class="cursor-pointer transition-colors"
              style="border-bottom:1px solid var(--border);"
              @mouseover="e => e.currentTarget.style.background='var(--surface)'"
              @mouseleave="e => e.currentTarget.style.background=''"
              @click="$router.push(`/artikel/${a.id}`)">
              <td class="py-2.5 pr-4 font-mono text-xs" style="color:var(--muted);">{{ a.article_number }}</td>
              <td class="py-2.5 pr-4 font-medium" style="color:var(--text);">
                {{ a.name }}
                <span class="ml-2 lg:hidden inline-flex items-center text-xs px-1.5 py-0.5 rounded"
                  :style="`background:${TYPE_META[a.type]?.bg};color:${TYPE_META[a.type]?.color};`">
                  {{ TYPE_META[a.type]?.label }}
                </span>
              </td>
              <td class="py-2.5 pr-4 hidden lg:table-cell">
                <span class="inline-flex items-center text-xs px-2 py-0.5 rounded font-medium"
                  :style="`background:${TYPE_META[a.type]?.bg};color:${TYPE_META[a.type]?.color};`">
                  {{ TYPE_META[a.type]?.label }}
                </span>
              </td>
              <td class="py-2.5 pr-4 text-right font-semibold text-xs"
                :style="`color:${isLowStock(a) ? 'var(--error)' : '#22C55E'}`">
                {{ fmtStock(a) }}
              </td>
              <td class="py-2.5 pr-4 text-xs hidden lg:table-cell" style="color:var(--muted);">{{ a.location || '—' }}</td>
              <td class="py-2.5 text-xs hidden xl:table-cell" style="color:var(--muted);">{{ a.supplier_name || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ── Pagination ──────────────────────────────────────────────────────── -->
      <div class="flex-shrink-0 flex items-center justify-between px-5 py-2 text-xs"
        style="border-top:1px solid var(--border);color:var(--muted);">
        <span>{{ total }} Artikel</span>
        <div class="flex items-center gap-2">
          <button :disabled="page <= 1" @click="page--; fetchArticles()"
            class="px-2 py-1 rounded transition-opacity" :style="page<=1 ? 'opacity:.3' : ''"
            style="background:var(--card);color:var(--text);">‹</button>
          <span>Seite {{ page }} / {{ Math.max(1, Math.ceil(total/limit)) }}</span>
          <button :disabled="page >= Math.ceil(total/limit)" @click="page++; fetchArticles()"
            class="px-2 py-1 rounded transition-opacity"
            :style="page >= Math.ceil(total/limit) ? 'opacity:.3' : ''"
            style="background:var(--card);color:var(--text);">›</button>
        </div>
      </div>
    </div>

    <!-- ── Create / Edit panel ────────────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="panelOpen" class="fixed inset-0 z-40 flex justify-end"
        style="-webkit-tap-highlight-color:transparent;">
        <div class="flex-1 bg-black/50" @click="panelOpen = false" />
        <div class="w-full max-w-md flex flex-col overflow-hidden"
          style="background:var(--surface);border-left:1px solid var(--border);">

          <div class="flex items-center justify-between px-5 py-4 flex-shrink-0"
            style="border-bottom:1px solid var(--border);">
            <h2 class="font-semibold" style="color:var(--text);">{{ editingId ? 'Artikel bearbeiten' : 'Neuer Artikel' }}</h2>
            <button class="text-xl leading-none" style="color:var(--muted);" @click="panelOpen = false">×</button>
          </div>

          <div class="flex-1 overflow-y-auto px-5 py-4">
            <form @submit.prevent="saveArticle" class="flex flex-col gap-4">

              <div v-for="field in formFields" :key="field.key">
                <label class="block text-xs font-medium mb-1" style="color:var(--muted);">
                  {{ field.label }}<span v-if="field.required" style="color:var(--error);"> *</span>
                </label>

                <select v-if="field.type === 'select'" v-model="form[field.key]"
                  class="w-full rounded-lg px-3 text-sm"
                  style="height:40px;background:var(--card);border:1px solid var(--border);color:var(--text);outline:none;">
                  <option v-if="!field.required" value="">— keine —</option>
                  <option v-for="opt in field.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>

                <input v-else v-model="form[field.key]" :type="field.inputType || 'text'"
                  :placeholder="field.placeholder || ''"
                  :step="field.step"
                  class="w-full rounded-lg px-3 text-sm"
                  style="height:40px;background:var(--card);border:1px solid var(--border);color:var(--text);outline:none;" />
              </div>

              <div v-if="formError" class="rounded-lg px-3 py-2 text-xs" style="background:rgba(239,68,68,.12);color:var(--error);">{{ formError }}</div>

              <button type="submit"
                class="w-full rounded-lg font-semibold text-sm mt-2"
                style="height:44px;background:var(--accent);color:#fff;"
                :style="saving ? 'opacity:.6' : ''"
                :disabled="saving">
                {{ saving ? 'Wird gespeichert…' : (editingId ? 'Speichern' : 'Artikel anlegen') }}
              </button>
            </form>
          </div>
        </div>
      </div>
    </Teleport>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import AppLayout from '@/components/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'
import api from '@/api/axios'
import { TYPE_META, VALID_TYPES, fmtStock, isLowStock } from '@/utils/labels.js'

const auth = useAuthStore()

// ── Data ──────────────────────────────────────────────────────────────────────
const articles       = ref([])
const total          = ref(0)
const categories     = ref([])
const loading        = ref(false)
const page           = ref(1)
const limit          = 50

const search         = ref('')
const filterType     = ref('')
const filterCategory = ref('')
const filterLowStock = ref(false)

// ── Panel ─────────────────────────────────────────────────────────────────────
const panelOpen  = ref(false)
const editingId  = ref(null)
const saving     = ref(false)
const formError  = ref('')

const emptyForm  = () => ({ name:'', type:'consumable', barcode:'', description:'', category_id:'', supplier_id:'', purchase_price:'', min_stock:0, stock_qty:0, stock_meters:0, bundle_size:'', unit:'', location:'' })
const form       = ref(emptyForm())

// Dynamic form fields based on selected type
const formFields = computed(() => {
  const t = form.value.type
  const fields = [
    { key:'name',           label:'Bezeichnung',   required:true },
    { key:'type',           label:'Typ',            required:true, type:'select', options: VALID_TYPES.map(v => ({ value:v, label:TYPE_META[v].label })) },
    { key:'barcode',        label:'Barcode / EAN',  placeholder:'optional' },
    { key:'category_id',    label:'Kategorie',      type:'select', options: categories.value.map(c => ({ value:c.id, label:c.name })) },
    { key:'purchase_price', label:'Einkaufspreis',  inputType:'number', step:'0.01', placeholder:'€' },
    { key:'min_stock',      label:t === 'cable' ? 'Mindestbestand (m)' : 'Mindestbestand (Stk)', inputType:'number', step: t === 'cable' ? '0.5' : '1' },
  ]
  if (!editingId.value) {
    fields.push(t === 'cable'
      ? { key:'stock_meters', label:'Anfangsbestand (m)', inputType:'number', step:'0.5' }
      : { key:'stock_qty',    label:'Anfangsbestand (Stk)', inputType:'number', step:'1' }
    )
  }
  if (t === 'bundle') fields.push({ key:'bundle_size', label:'Stück pro Gebinde', inputType:'number', step:'1' })
  fields.push({ key:'location', label:'Lagerort', placeholder:'Regal A-3' })
  return fields
})

// ── Fetch ─────────────────────────────────────────────────────────────────────
let debounceTimer = null
function debounceFetch() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { page.value = 1; fetchArticles() }, 300)
}

async function fetchArticles() {
  loading.value = true
  try {
    const params = new URLSearchParams({
      limit, offset: (page.value - 1) * limit,
      ...(search.value       && { search:      search.value }),
      ...(filterType.value   && { type:         filterType.value }),
      ...(filterCategory.value && { category_id: filterCategory.value }),
      ...(filterLowStock.value && { low_stock:   '1' }),
    })
    const { data } = await api.get(`/articles?${params}`)
    articles.value = data.articles
    total.value    = data.total
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  fetchArticles()
  const { data } = await api.get('/categories')
  categories.value = data.categories
})

// ── Panel actions ─────────────────────────────────────────────────────────────
function openCreate() {
  editingId.value = null
  form.value      = emptyForm()
  formError.value = ''
  panelOpen.value = true
}

function openEdit(article) {
  editingId.value = article.id
  form.value      = { ...emptyForm(), ...article, category_id: article.category_id ?? '', supplier_id: article.supplier_id ?? '' }
  formError.value = ''
  panelOpen.value = true
}

async function saveArticle() {
  saving.value    = true
  formError.value = ''
  try {
    if (editingId.value) {
      await api.put(`/articles/${editingId.value}`, form.value)
    } else {
      await api.post('/articles', form.value)
    }
    panelOpen.value = false
    fetchArticles()
  } catch (err) {
    formError.value = err.response?.data?.error ?? 'Fehler beim Speichern'
  } finally {
    saving.value = false
  }
}
</script>
