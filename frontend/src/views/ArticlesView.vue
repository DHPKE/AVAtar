<template>
  <AppLayout>
    <div class="flex flex-col h-full">

      <!-- ── Header bar ──────────────────────────────────────────────────────── -->
      <div class="flex-shrink-0 flex items-center justify-between px-5 py-3"
        style="border-bottom:1px solid var(--border);background:var(--surface);">
        <h1 class="font-semibold" style="color:var(--text);">Artikel</h1>
        <button v-if="auth.hasMinRole('warehouse_manager')"
          class="rounded-lg px-3 text-sm font-medium"
          style="height:36px;background:var(--accent);color:#fff;" @click="openCreate">+ Neuer Artikel</button>
      </div>

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

        <select v-model="filterGroup" @change="fetchArticles"
          class="rounded-lg px-2 text-sm"
          style="height:36px;background:var(--card);border:1px solid var(--border);color:var(--text);outline:none;">
          <option value="">Alle Gruppen</option>
          <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
        </select>

        <label class="flex items-center gap-1.5 text-sm cursor-pointer select-none" style="color:var(--muted);">
          <input type="checkbox" v-model="filterLowStock" @change="fetchArticles" class="rounded" />
          Niedrig-Bestand
        </label>
      </div>

      <!-- ── Table ───────────────────────────────────────────────────────────── -->
      <div class="flex-1 overflow-auto px-5 py-3">
        <div v-if="loading" class="flex justify-center py-16">
          <div class="w-8 h-8 rounded-full border-2 animate-spin" style="border-color:var(--accent);border-top-color:transparent;" />
        </div>
        <div v-else-if="!articles.length" class="text-sm text-center py-16" style="color:var(--muted);">Keine Artikel gefunden</div>
        <table v-else class="w-full text-sm" style="border-collapse:collapse;">
          <thead>
            <tr style="background:var(--surface);border-bottom:1px solid var(--border);">
              <th class="text-left py-2 pr-4 font-medium text-xs" style="color:var(--muted);">Nr.</th>
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
              <td class="py-2.5 pr-4 text-xs hidden lg:table-cell" style="color:var(--muted);">{{ fmtLocation(a) }}</td>
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

    <!-- ── Panel ─────────────────────────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="panelOpen" class="fixed inset-0 z-40 flex justify-end">
        <div class="flex-1 bg-black/50" @click="panelOpen = false" />
        <div class="w-full max-w-sm flex flex-col" style="background:var(--surface);border-left:1px solid var(--border);">
          <div class="flex items-center justify-between px-5 py-4 flex-shrink-0" style="border-bottom:1px solid var(--border);">
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

            <!-- ── Sammelartikel: Komponenten verwalten ───────────────────────── -->
            <div v-if="form.type === 'sammelartikel'" class="mt-6 pt-5" style="border-top:1px solid var(--border);">
              <h3 class="text-sm font-semibold mb-1" style="color:var(--text);">Komponenten</h3>
              <p v-if="!editingId" class="text-xs" style="color:var(--muted);">
                Bitte zuerst den Sammelartikel anlegen — danach können hier die Einzelartikel hinterlegt werden, die beim Buchen mit abgebucht werden.
              </p>

              <template v-else>
                <div v-if="componentsLoading" class="flex justify-center py-4">
                  <div class="w-5 h-5 rounded-full border-2 animate-spin" style="border-color:var(--accent);border-top-color:transparent;" />
                </div>

                <div v-else>
                  <div v-if="!components.length" class="text-xs py-2" style="color:var(--muted);">Noch keine Komponenten hinterlegt</div>

                  <div v-for="c in components" :key="c.id"
                    class="flex items-center gap-2 py-2" style="border-bottom:1px solid var(--border);">
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium truncate" style="color:var(--text);">{{ c.name }}</p>
                      <p class="text-xs font-mono" style="color:var(--muted);">{{ c.article_number }}</p>
                    </div>
                    <span class="text-xs flex-shrink-0" style="color:var(--muted);">{{ c.qty }} {{ c.unit === 'meter' ? 'm' : 'Stk' }} / Einheit</span>
                    <button type="button" class="text-xs px-2 py-1 rounded flex-shrink-0"
                      style="background:rgba(239,68,68,.12);color:var(--error);"
                      @click="removeComponent(c)">Entfernen</button>
                  </div>

                  <div class="flex flex-col gap-2 mt-3">
                    <select v-model="newComponentId" class="w-full rounded-lg px-3 text-sm"
                      style="height:40px;background:var(--card);border:1px solid var(--border);color:var(--text);outline:none;">
                      <option value="">Artikel wählen…</option>
                      <option v-for="opt in availableComponentOptions" :key="opt.id" :value="opt.id">
                        {{ opt.name }} ({{ opt.article_number }})
                      </option>
                    </select>
                    <div class="flex gap-2">
                      <input v-model="newComponentQty" type="number" min="0.01" step="1" placeholder="Menge / Einheit"
                        class="flex-1 rounded-lg px-3 text-sm" style="height:40px;background:var(--card);border:1px solid var(--border);color:var(--text);outline:none;" />
                      <button type="button" class="rounded-lg px-3 text-sm font-medium flex-shrink-0"
                        style="height:40px;background:var(--accent);color:#fff;"
                        :disabled="!newComponentId || !newComponentQty"
                        @click="addComponent">Hinzufügen</button>
                    </div>
                  </div>
                  <div v-if="componentsError" class="rounded-lg px-3 py-2 text-xs mt-2" style="background:rgba(239,68,68,.12);color:var(--error);">{{ componentsError }}</div>
                </div>
              </template>
            </div>

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
import { TYPE_META, VALID_TYPES, fmtStock, fmtLocation, isLowStock } from '@/utils/labels.js'

const auth = useAuthStore()

// ── Data ──────────────────────────────────────────────────────────────────────
const articles       = ref([])
const total          = ref(0)
const categories     = ref([])
const groups         = ref([])
const loading        = ref(false)
const page           = ref(1)
const limit          = 50

const search         = ref('')
const filterType     = ref('')
const filterCategory = ref('')
const filterGroup    = ref('')
const filterLowStock = ref(false)

// ── Panel ─────────────────────────────────────────────────────────────────────
const panelOpen  = ref(false)
const editingId  = ref(null)
const saving     = ref(false)
const formError  = ref('')

const emptyForm = () => ({
  name:'', type:'consumable', barcode:'', description:'',
  category_id:'', group_id:'', supplier_id:'', purchase_price:'',
  min_stock:0, stock_qty:0, stock_meters:0, bundle_size:'', unit:'',
  location_row:'', location_shelf:'', location_bin:'',
})
const form = ref(emptyForm())

// Dynamic form fields based on selected type
const formFields = computed(() => {
  const t = form.value.type
  const fields = [
    { key:'name',           label:'Bezeichnung',   required:true },
    { key:'type',           label:'Typ',            required:true, type:'select', options: VALID_TYPES.map(v => ({ value:v, label:TYPE_META[v].label })) },
    { key:'barcode',        label:'Barcode / EAN',  placeholder:'optional' },
    { key:'category_id',    label:'Kategorie',      type:'select', options: categories.value.map(c => ({ value:c.id, label:c.name })) },
    { key:'group_id',       label:'Gruppe',         type:'select', options: groups.value.map(g => ({ value:g.id, label:g.name })) },
    { key:'purchase_price', label:'Einkaufspreis',  inputType:'number', step:'0.01', placeholder:'€' },
    { key:'min_stock',      label:t === 'cable' ? 'Mindestbestand (m)' : 'Mindestbestand (Stk)', inputType:'number', step: t === 'cable' ? '0.5' : '1' },
  ]
  if (!editingId.value) {
    fields.push(t === 'cable'
      ? { key:'stock_meters', label:'Aktueller Bestand (m)',   inputType:'number', step:'0.5' }
      : { key:'stock_qty',    label:'Aktueller Bestand (Stk)', inputType:'number', step:'1' }
    )
  }
  if (t === 'bundle') fields.push({ key:'bundle_size', label:'Stück pro Gebinde', inputType:'number', step:'1' })
  fields.push(
    { key:'location_row',   label:'Lagerort — Reihe', placeholder:'optional' },
    { key:'location_shelf', label:'Lagerort — Regal', placeholder:'optional' },
    { key:'location_bin',   label:'Lagerort — Fach',  placeholder:'optional' },
  )
  return fields
})

// ── Fetch articles ─────────────────────────────────────────────────────────────
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
      ...(search.value         && { search:      search.value }),
      ...(filterType.value     && { type:         filterType.value }),
      ...(filterCategory.value && { category_id: filterCategory.value }),
      ...(filterGroup.value    && { group_id:     filterGroup.value }),
      ...(filterLowStock.value && { low_stock:    '1' }),
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
  const [{ data: catData }, { data: grpData }] = await Promise.all([
    api.get('/categories'),
    api.get('/groups'),
  ])
  categories.value = catData.categories
  groups.value     = grpData.groups
})

// ── Panel actions ─────────────────────────────────────────────────────────────
function openCreate() {
  editingId.value = null
  form.value      = emptyForm()
  formError.value = ''
  components.value = []
  panelOpen.value = true
}

function openEdit(article) {
  editingId.value = article.id
  form.value      = {
    ...emptyForm(), ...article,
    category_id: article.category_id ?? '',
    group_id:    article.group_id    ?? '',
    supplier_id: article.supplier_id ?? '',
  }
  formError.value = ''
  panelOpen.value = true
  if (article.type === 'sammelartikel') fetchComponents()
}

async function saveArticle() {
  saving.value    = true
  formError.value = ''
  try {
    if (editingId.value) {
      const { data } = await api.put(`/articles/${editingId.value}`, form.value)
      if (data.article.type === 'sammelartikel') fetchComponents()
    } else {
      const { data } = await api.post('/articles', form.value)
      if (data.article.type === 'sammelartikel') {
        // Sammelartikel ist jetzt angelegt — Panel offen lassen, damit Komponenten ergänzt werden können
        editingId.value = data.article.id
        fetchComponents()
        fetchArticles()
        return
      }
    }
    panelOpen.value = false
    fetchArticles()
  } catch (err) {
    formError.value = err.response?.data?.error ?? 'Fehler beim Speichern'
  } finally {
    saving.value = false
  }
}

// ── Sammelartikel-Komponenten ─────────────────────────────────────────────────
const components         = ref([])
const componentsLoading   = ref(false)
const componentsError     = ref('')
const newComponentId      = ref('')
const newComponentQty     = ref('1')
const allActiveArticles   = ref([])

const availableComponentOptions = computed(() =>
  allActiveArticles.value.filter(a =>
    a.id !== editingId.value &&
    a.type !== 'sammelartikel' &&
    !components.value.some(c => c.component_article_id === a.id)
  )
)

async function fetchComponents() {
  if (!editingId.value) return
  componentsLoading.value = true
  componentsError.value  = ''
  try {
    const [{ data: compData }, { data: artData }] = await Promise.all([
      api.get(`/articles/${editingId.value}/components`),
      allActiveArticles.value.length ? Promise.resolve({ data: { articles: allActiveArticles.value } }) : api.get('/articles?limit=200&active=1'),
    ])
    components.value       = compData.components
    allActiveArticles.value = artData.articles
  } finally {
    componentsLoading.value = false
  }
}

async function addComponent() {
  componentsError.value = ''
  try {
    await api.post(`/articles/${editingId.value}/components`, {
      component_article_id: newComponentId.value,
      qty: newComponentQty.value,
    })
    newComponentId.value  = ''
    newComponentQty.value = '1'
    fetchComponents()
  } catch (err) { componentsError.value = err.response?.data?.error ?? 'Fehler beim Hinzufügen' }
}

async function removeComponent(c) {
  if (!confirm(`"${c.name}" aus dem Sammelartikel entfernen?`)) return
  try {
    await api.delete(`/articles/${editingId.value}/components/${c.id}`)
    fetchComponents()
  } catch (err) { componentsError.value = err.response?.data?.error ?? 'Fehler beim Entfernen' }
}
</script>
