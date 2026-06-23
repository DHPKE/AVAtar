<template>
  <AppLayout>
    <div class="flex flex-col h-full">
      <div class="flex-shrink-0 flex items-center justify-between px-5 py-3"
        style="border-bottom:1px solid var(--border);background:var(--surface);">
        <h1 class="font-semibold" style="color:var(--text);">Inventur</h1>
        <button class="rounded-lg px-3 text-sm font-medium"
          style="height:36px;background:var(--accent);color:#fff;" @click="panelOpen = true">+ Neue Inventur</button>
      </div>

      <div class="flex-1 overflow-auto px-5 py-3">
        <div v-if="loading" class="flex justify-center py-16">
          <div class="w-8 h-8 rounded-full border-2 animate-spin" style="border-color:var(--accent);border-top-color:transparent;" />
        </div>
        <div v-else-if="!stocktakes.length" class="text-sm text-center py-16" style="color:var(--muted);">Noch keine Inventuren</div>
        <table v-else class="w-full text-sm" style="border-collapse:collapse;">
          <thead>
            <tr style="background:var(--surface);border-bottom:1px solid var(--border);">
              <th class="text-left py-2 pr-4 font-medium text-xs" style="color:var(--muted);">Name</th>
              <th class="text-left py-2 pr-4 font-medium text-xs" style="color:var(--muted);">Status</th>
              <th class="text-right py-2 pr-4 font-medium text-xs" style="color:var(--muted);">Gezählt</th>
              <th class="text-left py-2 pr-4 font-medium text-xs hidden sm:table-cell" style="color:var(--muted);">Erstellt von</th>
              <th class="text-left py-2 font-medium text-xs hidden sm:table-cell" style="color:var(--muted);">Datum</th>
              <th class="py-2"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in stocktakes" :key="s.id"
              class="cursor-pointer transition-colors"
              style="border-bottom:1px solid var(--border);"
              @mouseover="e => e.currentTarget.style.background='var(--surface)'"
              @mouseleave="e => e.currentTarget.style.background=''"
              @click="$router.push(`/inventur/${s.id}`)">
              <td class="py-2.5 pr-4 font-medium" style="color:var(--text);">{{ s.name }}</td>
              <td class="py-2.5 pr-4">
                <span class="inline-flex items-center text-xs px-2 py-0.5 rounded font-medium"
                  :style="s.status === 'closed'
                    ? 'background:rgba(34,197,94,.15);color:#22C55E;'
                    : 'background:rgba(245,158,11,.15);color:#F59E0B;'">
                  {{ s.status === 'closed' ? 'Abgeschlossen' : 'Offen' }}
                </span>
              </td>
              <td class="py-2.5 pr-4 text-right text-xs" style="color:var(--muted);">{{ s.counted_count }} / {{ s.item_count }}</td>
              <td class="py-2.5 pr-4 text-xs hidden sm:table-cell" style="color:var(--muted);">{{ s.created_by_username }}</td>
              <td class="py-2.5 text-xs hidden sm:table-cell" style="color:var(--muted);">{{ fmtDate(s.created_at) }}</td>
              <td class="py-2.5 pr-2 text-right">
                <button v-if="s.status === 'open'" type="button" class="text-xs px-2 py-1 rounded"
                  style="background:rgba(239,68,68,.12);color:var(--error);"
                  @click.stop="deleteStocktake(s)">Löschen</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Create panel ──────────────────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="panelOpen" class="fixed inset-0 z-40 flex justify-end">
        <div class="flex-1 bg-black/50" @click="panelOpen = false" />
        <div class="w-full max-w-sm flex flex-col" style="background:var(--surface);border-left:1px solid var(--border);">
          <div class="flex items-center justify-between px-5 py-4 flex-shrink-0" style="border-bottom:1px solid var(--border);">
            <h2 class="font-semibold" style="color:var(--text);">Neue Inventur</h2>
            <button class="text-xl leading-none" style="color:var(--muted);" @click="panelOpen = false">×</button>
          </div>

          <div class="flex-1 overflow-y-auto px-5 py-4">
            <form @submit.prevent="createStocktake" class="flex flex-col gap-4">
              <div>
                <label class="block text-xs font-medium mb-1" style="color:var(--muted);">Bezeichnung <span style="color:var(--error);">*</span></label>
                <input v-model="form.name" type="text" placeholder="z.B. Q2 2026 — Lager"
                  class="w-full rounded-lg px-3 text-sm"
                  style="height:40px;background:var(--card);border:1px solid var(--border);color:var(--text);outline:none;" />
              </div>

              <p class="text-xs" style="color:var(--muted);">
                Optional einschränken — sonst werden alle aktiven Artikel aufgenommen.
              </p>

              <div>
                <label class="block text-xs font-medium mb-1" style="color:var(--muted);">Typ</label>
                <select v-model="form.type" class="w-full rounded-lg px-3 text-sm"
                  style="height:40px;background:var(--card);border:1px solid var(--border);color:var(--text);outline:none;">
                  <option value="">Alle Typen</option>
                  <option v-for="t in VALID_TYPES" :key="t" :value="t">{{ TYPE_META[t].label }}</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-medium mb-1" style="color:var(--muted);">Kategorie</label>
                <select v-model="form.category_id" class="w-full rounded-lg px-3 text-sm"
                  style="height:40px;background:var(--card);border:1px solid var(--border);color:var(--text);outline:none;">
                  <option value="">Alle Kategorien</option>
                  <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-medium mb-1" style="color:var(--muted);">Gruppe</label>
                <select v-model="form.group_id" class="w-full rounded-lg px-3 text-sm"
                  style="height:40px;background:var(--card);border:1px solid var(--border);color:var(--text);outline:none;">
                  <option value="">Alle Gruppen</option>
                  <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
                </select>
              </div>

              <div v-if="formError" class="rounded-lg px-3 py-2 text-xs" style="background:rgba(239,68,68,.12);color:var(--error);">{{ formError }}</div>

              <button type="submit"
                class="w-full rounded-lg font-semibold text-sm mt-2"
                style="height:44px;background:var(--accent);color:#fff;"
                :style="saving ? 'opacity:.6' : ''"
                :disabled="saving">
                {{ saving ? 'Wird erstellt…' : 'Inventur starten' }}
              </button>
            </form>
          </div>
        </div>
      </div>
    </Teleport>
  </AppLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AppLayout from '@/components/AppLayout.vue'
import api from '@/api/axios'
import { TYPE_META, VALID_TYPES, fmtDate } from '@/utils/labels.js'
import { useRouter } from 'vue-router'

const router = useRouter()

const stocktakes = ref([])
const loading     = ref(false)
const categories  = ref([])
const groups      = ref([])

const panelOpen = ref(false)
const saving    = ref(false)
const formError = ref('')
const form = ref({ name: '', type: '', category_id: '', group_id: '' })

async function fetchStocktakes() {
  loading.value = true
  try {
    const { data } = await api.get('/stocktakes')
    stocktakes.value = data.stocktakes
  } finally {
    loading.value = false
  }
}

async function createStocktake() {
  saving.value    = true
  formError.value = ''
  try {
    const { data } = await api.post('/stocktakes', {
      name:        form.value.name,
      type:        form.value.type        || undefined,
      category_id: form.value.category_id || undefined,
      group_id:    form.value.group_id    || undefined,
    })
    router.push(`/inventur/${data.stocktake.id}`)
  } catch (err) {
    formError.value = err.response?.data?.error ?? 'Fehler beim Erstellen'
  } finally {
    saving.value = false
  }
}

async function deleteStocktake(s) {
  if (!confirm(`Inventur "${s.name}" wirklich löschen?`)) return
  await api.delete(`/stocktakes/${s.id}`)
  fetchStocktakes()
}

onMounted(async () => {
  fetchStocktakes()
  const [{ data: catData }, { data: grpData }] = await Promise.all([
    api.get('/categories'),
    api.get('/groups'),
  ])
  categories.value = catData.categories
  groups.value     = grpData.groups
})
</script>
