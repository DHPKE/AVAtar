<template>
  <AppLayout>
    <div class="flex flex-col h-full">
      <!-- ── Filter bar (hidden when printing) ─────────────────────────────── -->
      <div class="no-print flex-shrink-0 flex flex-wrap items-center gap-2 px-5 py-3"
        style="border-bottom:1px solid var(--border);background:var(--surface);">
        <h1 class="font-semibold mr-2" style="color:var(--text);">Scanliste</h1>

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

        <select v-model="filterSupplier" @change="fetchArticles"
          class="rounded-lg px-2 text-sm"
          style="height:36px;background:var(--card);border:1px solid var(--border);color:var(--text);outline:none;">
          <option value="">Alle Lieferanten</option>
          <option v-for="s in suppliers" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>

        <select v-model="sortBy"
          class="rounded-lg px-2 text-sm"
          style="height:36px;background:var(--card);border:1px solid var(--border);color:var(--text);outline:none;">
          <option value="name">Sortierung: Name</option>
          <option value="supplier_name">Sortierung: Lieferant</option>
          <option value="group_name">Sortierung: Gruppe</option>
          <option value="category_name">Sortierung: Kategorie</option>
          <option value="manufacturer">Sortierung: Hersteller</option>
          <option value="created_at">Sortierung: Hinzugefügt</option>
        </select>

        <button class="rounded-lg px-3 text-sm font-medium ml-auto"
          style="height:36px;background:var(--accent);color:#fff;" @click="printList">Drucken</button>
      </div>

      <!-- ── Printable list ─────────────────────────────────────────────────── -->
      <div class="flex-1 overflow-auto px-5 py-3">
        <div v-if="loading" class="no-print flex justify-center py-16">
          <div class="w-8 h-8 rounded-full border-2 animate-spin" style="border-color:var(--accent);border-top-color:transparent;" />
        </div>
        <div v-else-if="!sortedArticles.length" class="no-print text-sm text-center py-16" style="color:var(--muted);">Keine Artikel gefunden</div>

        <div v-else class="grid gap-3" style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));">
          <div v-for="a in sortedArticles" :key="a.id"
            class="rounded-xl p-3 flex flex-col items-center text-center gap-1"
            style="background:var(--card);border:1px solid var(--border); break-inside: avoid; page-break-inside: avoid;">
            <p class="text-sm font-medium" style="color:var(--text);">{{ a.name }}</p>
            <p class="text-xs font-mono" style="color:var(--muted);">{{ a.article_number }}</p>
            <p class="text-xs" style="color:var(--muted);">{{ a.group_name || '—' }} · {{ a.category_name || '—' }}</p>
            <p class="text-xs" style="color:var(--muted);">{{ a.supplier_name || '—' }}</p>

            <img v-if="qrUrls[a.id]" :src="qrUrls[a.id]" width="96" height="96" alt="QR" />

            <svg :ref="el => (barcodeRefs[a.id] = el)" class="w-full" style="max-width:180px;"></svg>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, reactive } from 'vue'
import JsBarcode from 'jsbarcode'
import AppLayout from '@/components/AppLayout.vue'
import api from '@/api/axios'
import { TYPE_META, VALID_TYPES } from '@/utils/labels.js'

const articles       = ref([])
const loading        = ref(false)
const categories     = ref([])
const groups         = ref([])
const suppliers      = ref([])

const search         = ref('')
const filterType     = ref('')
const filterCategory = ref('')
const filterGroup    = ref('')
const filterSupplier = ref('')
const sortBy         = ref('name')

const qrUrls       = reactive({})
const barcodeRefs  = reactive({})

const sortedArticles = computed(() =>
  [...articles.value].sort((a, b) => {
    const av = a[sortBy.value] ?? ''
    const bv = b[sortBy.value] ?? ''
    return String(av).localeCompare(String(bv))
  })
)

let debounceTimer = null
function debounceFetch() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(fetchArticles, 300)
}

async function fetchArticles() {
  loading.value = true
  try {
    const params = new URLSearchParams({
      limit: '500',
      ...(search.value         && { search:      search.value }),
      ...(filterType.value     && { type:         filterType.value }),
      ...(filterCategory.value && { category_id: filterCategory.value }),
      ...(filterGroup.value    && { group_id:     filterGroup.value }),
      ...(filterSupplier.value && { supplier_id: filterSupplier.value }),
    })
    const { data } = await api.get(`/articles?${params}`)
    articles.value = data.articles
    await nextTick()
    renderCodes()
  } finally {
    loading.value = false
  }
}

async function renderCodes() {
  for (const a of articles.value) {
    if (!qrUrls[a.id]) {
      try {
        const { data } = await api.get(`/articles/${a.id}/qrcode.svg`, { responseType: 'blob' })
        qrUrls[a.id] = URL.createObjectURL(data)
      } catch { /* ignore */ }
    }
    const el = barcodeRefs[a.id]
    if (el) {
      try {
        JsBarcode(el, a.barcode || a.article_number, { format: 'CODE128', height: 40, fontSize: 12, margin: 4 })
      } catch { /* invalid barcode chars — skip */ }
    }
  }
}

function printList() { window.print() }

onMounted(async () => {
  fetchArticles()
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
