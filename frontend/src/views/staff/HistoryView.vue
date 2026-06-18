<template>
  <StaffLayout>
    <div class="px-4 pt-5 pb-4">
      <h1 class="text-lg font-semibold mb-4" style="color: var(--text);">Mein Verlauf</h1>

      <!-- Loading -->
      <div v-if="loading" class="flex justify-center py-12">
        <div class="w-8 h-8 rounded-full border-2 animate-spin"
          style="border-color:var(--accent);border-top-color:transparent;" />
      </div>

      <!-- Empty -->
      <div v-else-if="!movements.length" class="text-center py-12" style="color: var(--muted);">
        <p class="text-base">Noch keine Buchungen</p>
      </div>

      <!-- List -->
      <div v-else class="flex flex-col gap-2">
        <div
          v-for="m in movements"
          :key="m.id"
          class="rounded-xl px-4 py-3"
          style="background: var(--card); border: 1px solid var(--border);"
        >
          <div class="flex items-center justify-between mb-1">
            <span
              class="text-xs font-semibold px-2 py-0.5 rounded"
              :style="`background:${typeBg(m.type)};color:${typeColor(m.type)};`"
            >{{ typeLabel(m.type) }}</span>
            <span class="text-xs" style="color: var(--muted);">{{ formatTime(m.created_at) }}</span>
          </div>
          <p class="text-sm font-medium" style="color: var(--text);">{{ m.article_name }}</p>
          <p class="text-xs mt-0.5" style="color: var(--muted);">
            {{ m.article_unit === 'meter' ? `${m.meters} m` : `${m.qty} Stk` }}
            <span v-if="m.reference"> · {{ m.reference }}</span>
          </p>
        </div>
      </div>
    </div>
  </StaffLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import StaffLayout from '@/components/StaffLayout.vue'
import api from '@/api/axios'

const movements = ref([])
const loading   = ref(true)

onMounted(async () => {
  try {
    const { data } = await api.get('/movements?limit=50')
    movements.value = data.movements
  } finally {
    loading.value = false
  }
})

const TYPE_META = {
  in:         { label: 'Eingang',   color: '#22C55E', bg: 'rgba(34,197,94,.15)'  },
  out:        { label: 'Ausgang',   color: '#EF4444', bg: 'rgba(239,68,68,.15)'  },
  rental_out: { label: 'Verliehen', color: '#14B8A6', bg: 'rgba(20,184,166,.15)' },
  rental_in:  { label: 'Rückgabe', color: '#008FD0', bg: 'rgba(0,143,208,.15)'  },
  correction: { label: 'Korrektur', color: '#F59E0B', bg: 'rgba(245,158,11,.15)' },
}

function typeLabel(t) { return TYPE_META[t]?.label ?? t }
function typeColor(t) { return TYPE_META[t]?.color ?? 'var(--muted)' }
function typeBg(t)    { return TYPE_META[t]?.bg    ?? 'var(--surface)' }

function formatTime(iso) {
  return new Date(iso).toLocaleString('de-AT', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}
</script>
