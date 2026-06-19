<template>
  <AppLayout>
    <div class="flex flex-col h-full">
      <div class="flex-shrink-0 flex items-center justify-between px-5 py-3"
        style="border-bottom:1px solid var(--border);background:var(--surface);">
        <h1 class="font-semibold" style="color:var(--text);">Lieferanten</h1>
        <button class="rounded-lg px-3 text-sm font-medium"
          style="height:36px;background:var(--accent);color:#fff;" @click="openCreate">+ Neuer Lieferant</button>
      </div>

      <div class="flex-1 overflow-auto px-5 py-3">
        <div v-if="loading" class="flex justify-center py-16">
          <div class="w-8 h-8 rounded-full border-2 animate-spin" style="border-color:var(--accent);border-top-color:transparent;" />
        </div>
        <div v-else-if="!suppliers.length" class="text-sm text-center py-16" style="color:var(--muted);">Noch keine Lieferanten</div>
        <table v-else class="w-full text-sm" style="border-collapse:collapse;">
          <thead>
            <tr style="background:var(--surface);border-bottom:1px solid var(--border);">
              <th class="text-left py-2 pr-4 font-medium text-xs" style="color:var(--muted);">Name</th>
              <th class="text-left py-2 pr-4 font-medium text-xs hidden md:table-cell" style="color:var(--muted);">Ansprechpartner</th>
              <th class="text-left py-2 pr-4 font-medium text-xs hidden lg:table-cell" style="color:var(--muted);">E-Mail</th>
              <th class="text-left py-2 pr-4 font-medium text-xs hidden xl:table-cell" style="color:var(--muted);">Telefon</th>
              <th class="text-left py-2 pr-4 font-medium text-xs hidden xl:table-cell" style="color:var(--muted);">Ort</th>
              <th class="text-left py-2 font-medium text-xs hidden xl:table-cell" style="color:var(--muted);">Land</th>
              <th class="py-2"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in suppliers" :key="s.id"
              style="border-bottom:1px solid var(--border);"
              @mouseover="e => e.currentTarget.style.background='var(--surface)'"
              @mouseleave="e => e.currentTarget.style.background=''">
              <td class="py-2.5 pr-4 font-medium" style="color:var(--text);">{{ s.name }}</td>
              <td class="py-2.5 pr-4 text-xs hidden md:table-cell" style="color:var(--muted);">{{ s.contact_person || '—' }}</td>
              <td class="py-2.5 pr-4 text-xs hidden lg:table-cell" style="color:var(--muted);">{{ s.email || '—' }}</td>
              <td class="py-2.5 pr-4 text-xs hidden xl:table-cell" style="color:var(--muted);">{{ s.phone || '—' }}</td>
              <td class="py-2.5 pr-4 text-xs hidden xl:table-cell" style="color:var(--muted);">
                {{ [s.postal_code, s.city].filter(Boolean).join(' ') || '—' }}
              </td>
              <td class="py-2.5 text-xs hidden xl:table-cell" style="color:var(--muted);">{{ s.country || '—' }}</td>
              <td class="py-2.5 flex items-center gap-2 justify-end">
                <button class="text-xs px-2 py-1 rounded" style="background:var(--card);border:1px solid var(--border);color:var(--text);" @click="openEdit(s)">Bearbeiten</button>
                <button class="text-xs px-2 py-1 rounded" style="background:rgba(239,68,68,.12);color:var(--error);" @click="del(s)">Löschen</button>
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
            <h2 class="font-semibold" style="color:var(--text);">{{ editingId ? 'Lieferant bearbeiten' : 'Neuer Lieferant' }}</h2>
            <button style="color:var(--muted);font-size:1.25rem;" @click="panelOpen=false">×</button>
          </div>
          <div class="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
            <div v-for="f in fields" :key="f.key">
              <label class="block text-xs font-medium mb-1" style="color:var(--muted);">{{ f.label }}<span v-if="f.req" style="color:var(--error);"> *</span></label>
              <input v-model="form[f.key]" :type="f.type||'text'" class="w-full rounded-lg px-3 text-sm"
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

const suppliers = ref([])
const loading   = ref(true)
const panelOpen = ref(false)
const editingId = ref(null)
const saving    = ref(false)
const formError = ref('')

const fields = [
  { key:'name',           label:'Firmenname',      req:true },
  { key:'contact_person', label:'Ansprechpartner' },
  { key:'email',          label:'E-Mail',          type:'email' },
  { key:'phone',          label:'Telefon',         type:'tel'   },
  { key:'street',         label:'Straße'           },
  { key:'postal_code',    label:'PLZ'              },
  { key:'city',           label:'Ort'              },
  { key:'country',        label:'Land'             },
  { key:'conditions',     label:'Konditionen'      },
  { key:'notes',          label:'Notizen'          },
]

const emptyForm = () => ({
  name:'', contact_person:'', email:'', phone:'',
  street:'', postal_code:'', city:'', country:'', conditions:'', notes:'',
})
const form = ref(emptyForm())

onMounted(async () => {
  try { const { data } = await api.get('/suppliers'); suppliers.value = data.suppliers }
  finally { loading.value = false }
})

function openCreate() { editingId.value=null; form.value=emptyForm(); formError.value=''; panelOpen.value=true }
function openEdit(s)  { editingId.value=s.id; form.value={...emptyForm(),...s}; formError.value=''; panelOpen.value=true }

async function save() {
  saving.value=true; formError.value=''
  try {
    editingId.value ? await api.put(`/suppliers/${editingId.value}`,form.value) : await api.post('/suppliers',form.value)
    const { data } = await api.get('/suppliers'); suppliers.value = data.suppliers
    panelOpen.value=false
  } catch(err) { formError.value = err.response?.data?.error ?? 'Fehler' }
  finally { saving.value=false }
}

async function del(s) {
  if (!confirm(`Lieferant "${s.name}" löschen?`)) return
  try {
    await api.delete(`/suppliers/${s.id}`)
    const { data } = await api.get('/suppliers'); suppliers.value = data.suppliers
  } catch(err) { alert(err.response?.data?.error ?? 'Fehler beim Löschen') }
}
</script>
