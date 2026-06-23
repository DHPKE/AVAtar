<template>
  <AppLayout>
    <div class="flex flex-col h-full">
      <div class="flex-shrink-0 flex items-center gap-3 px-5 py-3 flex-wrap"
        style="border-bottom:1px solid var(--border);background:var(--surface);">
        <button @click="$router.push('/inventur')" class="text-sm" style="color:var(--muted);">← Zurück</button>
        <h1 class="font-semibold" style="color:var(--text);">{{ stocktake?.name }}</h1>
        <span v-if="stocktake" class="inline-flex items-center text-xs px-2 py-0.5 rounded font-medium"
          :style="stocktake.status === 'closed'
            ? 'background:rgba(34,197,94,.15);color:#22C55E;'
            : 'background:rgba(245,158,11,.15);color:#F59E0B;'">
          {{ stocktake.status === 'closed' ? 'Abgeschlossen' : 'Offen' }}
        </span>
        <div class="ml-auto flex gap-2">
          <button class="text-xs px-3 py-1.5 rounded-lg"
            style="background:var(--card);border:1px solid var(--border);color:var(--text);"
            :style="tab === 'diff' ? 'background:var(--accent);color:#fff;border-color:var(--accent);' : ''"
            @click="tab = tab === 'diff' ? 'count' : 'diff'; tab === 'diff' && fetchDiff()">
            Fehlmaterialliste
          </button>
          <button v-if="stocktake?.status === 'open'"
            class="text-xs px-3 py-1.5 rounded-lg font-medium"
            style="background:var(--accent);color:#fff;"
            :disabled="closing"
            @click="closeStocktake">
            {{ closing ? 'Wird abgeschlossen…' : 'Inventur abschließen' }}
          </button>
        </div>
      </div>

      <!-- ── Fehlmaterialliste ──────────────────────────────────────────────── -->
      <div v-if="tab === 'diff'" class="flex-1 overflow-auto px-5 py-3">
        <div v-if="diffLoading" class="flex justify-center py-16">
          <div class="w-8 h-8 rounded-full border-2 animate-spin" style="border-color:var(--accent);border-top-color:transparent;" />
        </div>
        <div v-else-if="!diff.length" class="text-sm text-center py-16" style="color:var(--muted);">Keine Abweichungen (oder noch nicht gezählt)</div>
        <table v-else class="w-full text-sm" style="border-collapse:collapse;">
          <thead>
            <tr style="background:var(--surface);border-bottom:1px solid var(--border);">
              <th class="text-left py-2 pr-4 font-medium text-xs" style="color:var(--muted);">Artikel</th>
              <th class="text-left py-2 pr-4 font-medium text-xs hidden sm:table-cell" style="color:var(--muted);">Lagerort</th>
              <th class="text-right py-2 pr-4 font-medium text-xs" style="color:var(--muted);">Soll</th>
              <th class="text-right py-2 pr-4 font-medium text-xs" style="color:var(--muted);">Ist</th>
              <th class="text-right py-2 font-medium text-xs" style="color:var(--muted);">Differenz</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in diff" :key="d.id" style="border-bottom:1px solid var(--border);">
              <td class="py-2.5 pr-4">
                <p class="font-medium" style="color:var(--text);">{{ d.article_name }}</p>
                <p class="text-xs font-mono" style="color:var(--muted);">{{ d.article_number }}</p>
              </td>
              <td class="py-2.5 pr-4 text-xs hidden sm:table-cell" style="color:var(--muted);">{{ fmtLoc(d) }}</td>
              <td class="py-2.5 pr-4 text-right" style="color:var(--muted);">{{ d.unit === 'meter' ? d.soll_meters + ' m' : d.soll_qty + ' Stk' }}</td>
              <td class="py-2.5 pr-4 text-right" style="color:var(--text);">{{ d.unit === 'meter' ? d.ist_meters + ' m' : d.ist_qty + ' Stk' }}</td>
              <td class="py-2.5 text-right font-semibold" :style="`color:${d.delta < 0 ? 'var(--error)' : '#22C55E'}`">
                {{ d.delta > 0 ? '+' : '' }}{{ d.delta }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ── Zähl-Erfassung ──────────────────────────────────────────────────── -->
      <template v-else>
        <div class="flex-shrink-0 flex flex-wrap items-center gap-2 px-5 py-3"
          style="border-bottom:1px solid var(--border);background:var(--surface);">
          <input v-model="search" type="search" placeholder="Suche…"
            class="rounded-lg px-3 text-sm flex-1 min-w-32"
            style="height:36px;background:var(--card);border:1px solid var(--border);color:var(--text);outline:none;"
            @input="debounceFetch" />

          <select v-model="filterCategory" @change="fetchItems"
            class="rounded-lg px-2 text-sm"
            style="height:36px;background:var(--card);border:1px solid var(--border);color:var(--text);outline:none;">
            <option value="">Alle Kategorien</option>
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>

          <select v-model="filterGroup" @change="fetchItems"
            class="rounded-lg px-2 text-sm"
            style="height:36px;background:var(--card);border:1px solid var(--border);color:var(--text);outline:none;">
            <option value="">Alle Gruppen</option>
            <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
          </select>

          <label class="flex items-center gap-1.5 text-sm cursor-pointer select-none" style="color:var(--muted);">
            <input type="checkbox" v-model="onlyOpen" @change="fetchItems" class="rounded" />
            Nur ungezählt
          </label>
        </div>

        <div class="flex-1 overflow-auto px-5 py-3">
          <div v-if="loading" class="flex justify-center py-16">
            <div class="w-8 h-8 rounded-full border-2 animate-spin" style="border-color:var(--accent);border-top-color:transparent;" />
          </div>
          <div v-else-if="!items.length" class="text-sm text-center py-16" style="color:var(--muted);">Keine Artikel gefunden</div>
          <table v-else class="w-full text-sm" style="border-collapse:collapse;">
            <thead>
              <tr style="background:var(--surface);border-bottom:1px solid var(--border);">
                <th class="text-left py-2 pr-4 font-medium text-xs" style="color:var(--muted);">Artikel</th>
                <th class="text-left py-2 pr-4 font-medium text-xs hidden sm:table-cell" style="color:var(--muted);">Lagerort</th>
                <th class="text-right py-2 pr-4 font-medium text-xs" style="color:var(--muted);">Soll</th>
                <th class="text-right py-2 font-medium text-xs" style="color:var(--muted);">Ist</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="i in items" :key="i.id" style="border-bottom:1px solid var(--border);">
                <td class="py-2.5 pr-4">
                  <p class="font-medium" style="color:var(--text);">{{ i.article_name }}</p>
                  <p class="text-xs font-mono" style="color:var(--muted);">{{ i.article_number }}</p>
                </td>
                <td class="py-2.5 pr-4 text-xs hidden sm:table-cell" style="color:var(--muted);">{{ fmtLoc(i) }}</td>
                <td class="py-2.5 pr-4 text-right" style="color:var(--muted);">{{ i.unit === 'meter' ? i.soll_meters + ' m' : i.soll_qty + ' Stk' }}</td>
                <td class="py-2.5 text-right">
                  <input type="number" min="0" :step="i.unit === 'meter' ? '0.5' : '1'"
                    :disabled="stocktake?.status === 'closed'"
                    v-model="counts[i.id]"
                    @change="saveCount(i)"
                    class="w-24 rounded-lg px-2 text-sm text-right"
                    :style="`height:32px;background:var(--card);border:1px solid ${i.counted_at ? 'var(--accent)' : 'var(--border)'};color:var(--text);outline:none;`" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import api from '@/api/axios'
import { fmtLocation } from '@/utils/labels.js'

const route = useRoute()
const id    = route.params.id

const stocktake = ref(null)
const items     = ref([])
const loading   = ref(false)
const tab       = ref('count')

const diff        = ref([])
const diffLoading = ref(false)
const closing     = ref(false)

const search         = ref('')
const filterCategory = ref('')
const filterGroup    = ref('')
const onlyOpen       = ref(false)

const categories = ref([])
const groups     = ref([])
const counts     = reactive({})

function fmtLoc(i) { return fmtLocation(i) }

let debounceTimer = null
function debounceFetch() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(fetchItems, 300)
}

async function fetchStocktake() {
  const { data } = await api.get(`/stocktakes/${id}`)
  stocktake.value = data.stocktake
}

async function fetchItems() {
  loading.value = true
  try {
    const params = new URLSearchParams({
      ...(search.value         && { search:      search.value }),
      ...(filterCategory.value && { category_id: filterCategory.value }),
      ...(filterGroup.value    && { group_id:     filterGroup.value }),
      ...(onlyOpen.value       && { only_open:    '1' }),
    })
    const { data } = await api.get(`/stocktakes/${id}/items?${params}`)
    items.value = data.items
    for (const i of data.items) {
      counts[i.id] = i.counted_at
        ? (i.unit === 'meter' ? i.ist_meters : i.ist_qty)
        : ''
    }
  } finally {
    loading.value = false
  }
}

async function saveCount(item) {
  const value = counts[item.id]
  if (value === '' || value === null || value === undefined) return
  const payload = item.unit === 'meter' ? { meters: value } : { qty: value }
  const { data } = await api.put(`/stocktakes/${id}/items/${item.article_id}`, payload)
  Object.assign(item, data.item)
}

async function fetchDiff() {
  diffLoading.value = true
  try {
    const { data } = await api.get(`/stocktakes/${id}/diff`)
    diff.value = data.diff
  } finally {
    diffLoading.value = false
  }
}

async function closeStocktake() {
  if (!confirm('Inventur abschließen? Abweichungen werden als Korrektur-Buchung auf den Lagerbestand übernommen.')) return
  closing.value = true
  try {
    await api.post(`/stocktakes/${id}/close`)
    await fetchStocktake()
  } finally {
    closing.value = false
  }
}

onMounted(async () => {
  await fetchStocktake()
  fetchItems()
  const [{ data: catData }, { data: grpData }] = await Promise.all([
    api.get('/categories'),
    api.get('/groups'),
  ])
  categories.value = catData.categories
  groups.value     = grpData.groups
})
</script>
