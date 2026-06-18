<template>
  <AppLayout>
    <div class="flex flex-col h-full">
      <div class="flex-shrink-0 flex items-center justify-between px-5 py-3"
        style="border-bottom:1px solid var(--border);background:var(--surface);">
        <h1 class="font-semibold" style="color:var(--text);">Kategorien</h1>
        <button class="rounded-lg px-3 text-sm font-medium"
          style="height:36px;background:var(--accent);color:#fff;" @click="openCreate">+ Neue Kategorie</button>
      </div>

      <div class="flex-1 overflow-auto px-5 py-3">
        <div v-if="loading" class="flex justify-center py-16">
          <div class="w-8 h-8 rounded-full border-2 animate-spin" style="border-color:var(--accent);border-top-color:transparent;" />
        </div>
        <div v-else-if="!categories.length" class="text-sm text-center py-16" style="color:var(--muted);">Noch keine Kategorien</div>
        <table v-else class="w-full text-sm" style="border-collapse:collapse;">
          <thead>
            <tr style="background:var(--surface);border-bottom:1px solid var(--border);">
              <th class="text-left py-2 pr-4 font-medium text-xs" style="color:var(--muted);">Name</th>
              <th class="text-left py-2 pr-4 font-medium text-xs hidden md:table-cell" style="color:var(--muted);">Beschreibung</th>
              <th class="py-2"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in categories" :key="c.id"
              style="border-bottom:1px solid var(--border);"
              @mouseover="e => e.currentTarget.style.background='var(--surface)'"
              @mouseleave="e => e.currentTarget.style.background=''">
              <td class="py-2.5 pr-4 font-medium" style="color:var(--text);">{{ c.name }}</td>
              <td class="py-2.5 pr-4 text-xs hidden md:table-cell" style="color:var(--muted);">{{ c.description || '—' }}</td>
              <td class="py-2.5 flex items-center gap-2 justify-end">
                <button class="text-xs px-2 py-1 rounded" style="background:var(--card);border:1px solid var(--border);color:var(--text);" @click="openEdit(c)">Bearbeiten</button>
                <button class="text-xs px-2 py-1 rounded" style="background:rgba(239,68,68,.12);color:var(--error);" @click="del(c)">Löschen</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="panelOpen" class="fixed inset-0 z-40 flex justify-end">
        <div class="flex-1 bg-black/50" @click="panelOpen=false" />
        <div class="w-full max-w-sm flex flex-col" style="background:var(--surface);border-left:1px solid var(--border);">
          <div class="flex items-center justify-between px-5 py-4" style="border-bottom:1px solid var(--border);">
            <h2 class="font-semibold" style="color:var(--text);">{{ editingId ? 'Kategorie bearbeiten' : 'Neue Kategorie' }}</h2>
            <button style="color:var(--muted);font-size:1.25rem;" @click="panelOpen=false">×</button>
          </div>
          <div class="px-5 py-4 flex flex-col gap-4">
            <div>
              <label class="block text-xs font-medium mb-1" style="color:var(--muted);">Name *</label>
              <input v-model="form.name" type="text" class="w-full rounded-lg px-3 text-sm"
                style="height:40px;background:var(--card);border:1px solid var(--border);color:var(--text);outline:none;" />
            </div>
            <div>
              <label class="block text-xs font-medium mb-1" style="color:var(--muted);">Beschreibung</label>
              <input v-model="form.description" type="text" class="w-full rounded-lg px-3 text-sm"
                style="height:40px;background:var(--card);border:1px solid var(--border);color:var(--text);outline:none;" />
            </div>
            <div v-if="formError" class="rounded-lg px-3 py-2 text-xs" style="background:rgba(239,68,68,.12);color:var(--error);">{{ formError }}</div>
            <button class="w-full rounded-lg font-semibold text-sm" style="height:44px;background:var(--accent);color:#fff;" :disabled="saving" @click="save">
              {{ saving ? 'Wird gespeichert…' : (editingId ? 'Speichern' : 'Anlegen') }}
            </button>
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

const categories = ref([])
const loading    = ref(true)
const panelOpen  = ref(false)
const editingId  = ref(null)
const saving     = ref(false)
const formError  = ref('')
const form       = ref({ name:'', description:'' })

onMounted(async () => {
  try { const { data } = await api.get('/categories'); categories.value = data.categories }
  finally { loading.value = false }
})

function openCreate() { editingId.value=null; form.value={name:'',description:''}; formError.value=''; panelOpen.value=true }
function openEdit(c)  { editingId.value=c.id; form.value={name:c.name,description:c.description||''}; formError.value=''; panelOpen.value=true }

async function save() {
  saving.value=true; formError.value=''
  try {
    editingId.value ? await api.put(`/categories/${editingId.value}`,form.value) : await api.post('/categories',form.value)
    const { data } = await api.get('/categories'); categories.value = data.categories
    panelOpen.value = false
  } catch(err) { formError.value = err.response?.data?.error ?? 'Fehler' }
  finally { saving.value=false }
}

async function del(c) {
  if (!confirm(`Kategorie "${c.name}" löschen?`)) return
  try {
    await api.delete(`/categories/${c.id}`)
    const { data } = await api.get('/categories'); categories.value = data.categories
  } catch(err) { alert(err.response?.data?.error ?? 'Fehler beim Löschen') }
}
</script>
