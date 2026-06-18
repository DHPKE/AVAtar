<template>
  <AppLayout>
    <div class="flex flex-col h-full">

      <!-- Header bar -->
      <div class="flex-shrink-0 flex items-center justify-between px-5 py-3"
        style="border-bottom:1px solid var(--border);background:var(--surface);">
        <h1 class="font-semibold" style="color:var(--text);">Benutzerverwaltung</h1>
        <button class="rounded-lg px-3 text-sm font-medium"
          style="height:36px;background:var(--accent);color:#fff;"
          @click="openCreate">+ Neuer Benutzer</button>
      </div>

      <!-- Table -->
      <div class="flex-1 overflow-auto px-5 py-3">
        <div v-if="loading" class="flex justify-center py-16">
          <div class="w-8 h-8 rounded-full border-2 animate-spin" style="border-color:var(--accent);border-top-color:transparent;" />
        </div>
        <table v-else class="w-full text-sm" style="border-collapse:collapse;">
          <thead>
            <tr style="background:var(--surface);border-bottom:1px solid var(--border);">
              <th class="text-left py-2 pr-4 font-medium text-xs" style="color:var(--muted);">Benutzername</th>
              <th class="text-left py-2 pr-4 font-medium text-xs hidden md:table-cell" style="color:var(--muted);">E-Mail</th>
              <th class="text-left py-2 pr-4 font-medium text-xs" style="color:var(--muted);">Rolle</th>
              <th class="text-left py-2 pr-4 font-medium text-xs hidden lg:table-cell" style="color:var(--muted);">Status</th>
              <th class="text-left py-2 font-medium text-xs hidden lg:table-cell" style="color:var(--muted);">Angelegt</th>
              <th class="py-2"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.id"
              style="border-bottom:1px solid var(--border);"
              @mouseover="e => e.currentTarget.style.background='var(--surface)'"
              @mouseleave="e => e.currentTarget.style.background=''">
              <td class="py-2.5 pr-4 font-medium" style="color:var(--text);">
                {{ u.username }}
                <span v-if="u.id === auth.user?.id" class="ml-1 text-xs px-1 rounded" style="background:rgba(0,143,208,.15);color:var(--accent);">ich</span>
              </td>
              <td class="py-2.5 pr-4 text-xs hidden md:table-cell" style="color:var(--muted);">{{ u.email }}</td>
              <td class="py-2.5 pr-4">
                <span class="text-xs px-2 py-0.5 rounded font-medium"
                  :style="`background:${ROLE_META[u.role]?.bg};color:${ROLE_META[u.role]?.color};`">
                  {{ ROLE_META[u.role]?.label }}
                </span>
              </td>
              <td class="py-2.5 pr-4 hidden lg:table-cell">
                <span class="text-xs px-2 py-0.5 rounded"
                  :style="u.active ? 'background:rgba(34,197,94,.12);color:#22C55E;' : 'background:rgba(239,68,68,.12);color:var(--error);'">
                  {{ u.active ? 'Aktiv' : 'Inaktiv' }}
                </span>
              </td>
              <td class="py-2.5 pr-4 text-xs hidden lg:table-cell" style="color:var(--muted);">{{ fmtDate(u.created_at) }}</td>
              <td class="py-2.5">
                <button class="text-xs px-2 py-1 rounded transition-colors"
                  style="background:var(--card);border:1px solid var(--border);color:var(--text);"
                  @click="openEdit(u)">Bearbeiten</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Panel -->
    <Teleport to="body">
      <div v-if="panelOpen" class="fixed inset-0 z-40 flex justify-end">
        <div class="flex-1 bg-black/50" @click="panelOpen=false" />
        <div class="w-full max-w-sm flex flex-col" style="background:var(--surface);border-left:1px solid var(--border);">
          <div class="flex items-center justify-between px-5 py-4 flex-shrink-0" style="border-bottom:1px solid var(--border);">
            <h2 class="font-semibold" style="color:var(--text);">{{ editingId ? 'Benutzer bearbeiten' : 'Neuer Benutzer' }}</h2>
            <button style="color:var(--muted);font-size:1.25rem;" @click="panelOpen=false">×</button>
          </div>
          <div class="flex-1 overflow-y-auto px-5 py-4">
            <form @submit.prevent="save" class="flex flex-col gap-4">

              <div v-if="!editingId">
                <label class="block text-xs font-medium mb-1" style="color:var(--muted);">Benutzername *</label>
                <input v-model="form.username" type="text" autocomplete="off"
                  class="w-full rounded-lg px-3 text-sm" style="height:40px;background:var(--card);border:1px solid var(--border);color:var(--text);outline:none;" />
              </div>

              <div>
                <label class="block text-xs font-medium mb-1" style="color:var(--muted);">E-Mail *</label>
                <input v-model="form.email" type="email"
                  class="w-full rounded-lg px-3 text-sm" style="height:40px;background:var(--card);border:1px solid var(--border);color:var(--text);outline:none;" />
              </div>

              <div v-if="!editingId">
                <label class="block text-xs font-medium mb-1" style="color:var(--muted);">Passwort * (min. 8 Zeichen)</label>
                <input v-model="form.password" type="password"
                  class="w-full rounded-lg px-3 text-sm" style="height:40px;background:var(--card);border:1px solid var(--border);color:var(--text);outline:none;" />
              </div>

              <div>
                <label class="block text-xs font-medium mb-1" style="color:var(--muted);">Rolle</label>
                <select v-model="form.role" class="w-full rounded-lg px-3 text-sm"
                  style="height:40px;background:var(--card);border:1px solid var(--border);color:var(--text);outline:none;"
                  :disabled="editingId === auth.user?.id">
                  <option v-for="(meta, key) in ROLE_META" :key="key" :value="key">{{ meta.label }}</option>
                </select>
              </div>

              <div v-if="editingId">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" v-model="form.active" :disabled="editingId === auth.user?.id" />
                  <span class="text-sm" style="color:var(--text);">Konto aktiv</span>
                </label>
              </div>

              <div v-if="editingId">
                <label class="block text-xs font-medium mb-1" style="color:var(--muted);">Neues Passwort setzen (optional)</label>
                <div class="flex gap-2">
                  <input v-model="newPw" type="password" placeholder="min. 8 Zeichen"
                    class="flex-1 rounded-lg px-3 text-sm" style="height:40px;background:var(--card);border:1px solid var(--border);color:var(--text);outline:none;" />
                  <button type="button" class="rounded-lg px-3 text-sm" style="background:var(--card);border:1px solid var(--border);color:var(--text);"
                    :disabled="newPw.length < 8" @click="resetPassword">Setzen</button>
                </div>
              </div>

              <div v-if="formError" class="rounded-lg px-3 py-2 text-xs" style="background:rgba(239,68,68,.12);color:var(--error);">{{ formError }}</div>
              <div v-if="formSuccess" class="rounded-lg px-3 py-2 text-xs" style="background:rgba(34,197,94,.12);color:#22C55E;">{{ formSuccess }}</div>

              <button type="submit" class="w-full rounded-lg font-semibold text-sm" style="height:44px;background:var(--accent);color:#fff;" :disabled="saving">
                {{ saving ? 'Wird gespeichert…' : (editingId ? 'Speichern' : 'Benutzer anlegen') }}
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
import { useAuthStore } from '@/stores/auth'
import api from '@/api/axios'
import { fmtDate } from '@/utils/labels.js'

const auth = useAuthStore()
const users = ref([])
const loading = ref(true)
const panelOpen = ref(false)
const editingId = ref(null)
const saving = ref(false)
const formError = ref('')
const formSuccess = ref('')
const newPw = ref('')

const ROLE_META = {
  staff:             { label:'Mitarbeiter',   color:'#E4EDFF', bg:'rgba(228,237,255,.1)'  },
  warehouse_manager: { label:'Lagerverwalter', color:'#008FD0', bg:'rgba(0,143,208,.15)'  },
  admin:             { label:'Administrator',  color:'#F59E0B', bg:'rgba(245,158,11,.15)' },
}

const emptyForm = () => ({ username:'', email:'', password:'', role:'staff', active:true })
const form = ref(emptyForm())

onMounted(async () => {
  try { const { data } = await api.get('/users'); users.value = data.users }
  finally { loading.value = false }
})

function openCreate() { editingId.value = null; form.value = emptyForm(); formError.value = ''; formSuccess.value = ''; newPw.value = ''; panelOpen.value = true }
function openEdit(u)  { editingId.value = u.id; form.value = { ...emptyForm(), email:u.email, role:u.role, active:!!u.active }; formError.value = ''; formSuccess.value = ''; newPw.value = ''; panelOpen.value = true }

async function save() {
  saving.value = true; formError.value = ''; formSuccess.value = ''
  try {
    if (editingId.value) {
      await api.put(`/users/${editingId.value}`, { email:form.value.email, role:form.value.role, active:form.value.active })
    } else {
      await api.post('/users', form.value)
    }
    const { data } = await api.get('/users'); users.value = data.users
    panelOpen.value = false
  } catch (err) { formError.value = err.response?.data?.error ?? 'Fehler beim Speichern' }
  finally { saving.value = false }
}

async function resetPassword() {
  formError.value = ''; formSuccess.value = ''
  try {
    await api.post(`/users/${editingId.value}/reset-password`, { newPassword: newPw.value })
    formSuccess.value = 'Passwort erfolgreich zurückgesetzt'
    newPw.value = ''
  } catch (err) { formError.value = err.response?.data?.error ?? 'Fehler' }
}
</script>
