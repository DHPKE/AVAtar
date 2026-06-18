<template>
  <AppLayout>
    <div class="p-5 max-w-6xl mx-auto">

      <h1 class="text-xl font-semibold mb-5" style="color:var(--text);">Dashboard</h1>

      <!-- ── Stat cards ─────────────────────────────────────────────────────── -->
      <div class="grid grid-cols-2 gap-3 mb-5 lg:grid-cols-4">
        <div v-for="card in statCards" :key="card.label"
          class="rounded-xl px-4 py-3"
          style="background:var(--card);border:1px solid var(--border);">
          <p class="text-xs mb-1" style="color:var(--muted);">{{ card.label }}</p>
          <p class="text-3xl font-bold leading-none" :style="`color:${card.color}`">{{ card.value }}</p>
        </div>
      </div>

      <!-- ── Chart + low stock ──────────────────────────────────────────────── -->
      <div class="grid gap-4 mb-4 lg:grid-cols-3">

        <!-- 7-day movement chart -->
        <div class="lg:col-span-2 rounded-xl p-4" style="background:var(--card);border:1px solid var(--border);">
          <p class="text-sm font-semibold mb-3" style="color:var(--text);">Bewegungen — letzte 7 Tage</p>
          <div style="position:relative;height:200px;">
            <canvas ref="chartCanvas" />
          </div>
        </div>

        <!-- Low stock list -->
        <div class="rounded-xl p-4" style="background:var(--card);border:1px solid var(--border);">
          <p class="text-sm font-semibold mb-3" style="color:var(--text);">
            Niedrig-Bestand
            <span v-if="lowStock.length" class="ml-1 text-xs px-1.5 py-0.5 rounded" style="background:rgba(239,68,68,.15);color:var(--error);">{{ lowStock.length }}</span>
          </p>
          <div v-if="!lowStock.length" class="text-xs py-6 text-center" style="color:var(--muted);">Alle Bestände OK ✓</div>
          <div v-else class="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
            <RouterLink v-for="a in lowStock" :key="a.id" :to="`/artikel/${a.id}`"
              class="flex items-center justify-between rounded-lg px-3 py-2 text-xs hover:opacity-80 transition-opacity"
              style="background:var(--surface);">
              <span style="color:var(--text);" class="truncate mr-2">{{ a.name }}</span>
              <span class="font-bold flex-shrink-0" style="color:var(--error);">{{ fmtStock(a) }}</span>
            </RouterLink>
          </div>
        </div>
      </div>

      <!-- ── Active rentals ─────────────────────────────────────────────────── -->
      <div class="rounded-xl p-4" style="background:var(--card);border:1px solid var(--border);">
        <div class="flex items-center justify-between mb-3">
          <p class="text-sm font-semibold" style="color:var(--text);">Aktive Verleihe</p>
          <RouterLink to="/verleihe" class="text-xs" style="color:var(--accent);">Alle anzeigen →</RouterLink>
        </div>
        <div v-if="!activeRentals.length" class="text-xs py-4 text-center" style="color:var(--muted);">Keine aktiven Verleihe</div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-xs" style="border-collapse:collapse;">
            <thead>
              <tr style="border-bottom:1px solid var(--border);">
                <th class="text-left py-2 pr-4 font-medium" style="color:var(--muted);">Artikel</th>
                <th class="text-left py-2 pr-4 font-medium" style="color:var(--muted);">Seriennr.</th>
                <th class="text-left py-2 pr-4 font-medium" style="color:var(--muted);">Verliehen an</th>
                <th class="text-left py-2 font-medium" style="color:var(--muted);">Rückgabe</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in activeRentals.slice(0,8)" :key="r.id"
                style="border-bottom:1px solid var(--border);">
                <td class="py-2 pr-4" style="color:var(--text);">{{ r.article_name }}</td>
                <td class="py-2 pr-4 font-mono" style="color:var(--muted);">{{ r.serial_number }}</td>
                <td class="py-2 pr-4" style="color:var(--text);">{{ r.rented_to }}</td>
                <td class="py-2">
                  <span v-if="r.is_overdue" class="px-1.5 py-0.5 rounded text-xs font-medium"
                    style="background:rgba(239,68,68,.15);color:var(--error);">Überfällig</span>
                  <span v-else-if="r.expected_return" style="color:var(--muted);">{{ fmtDate(r.expected_return) }}</span>
                  <span v-else style="color:var(--muted);">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  </AppLayout>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { Chart, registerables } from 'chart.js'
import AppLayout from '@/components/AppLayout.vue'
import api from '@/api/axios'
import { fmtDate, fmtStock, lastNDays, MOVEMENT_META } from '@/utils/labels.js'

Chart.register(...registerables)

const chartCanvas  = ref(null)
const lowStock     = ref([])
const activeRentals = ref([])
const statCards    = ref([
  { label: 'Artikel gesamt', value: '—', color: 'var(--text)' },
  { label: 'Niedrig-Bestand', value: '—', color: 'var(--error)' },
  { label: 'Aktive Verleihe', value: '—', color: '#14B8A6' },
  { label: 'Überfällig',      value: '—', color: 'var(--warning)' },
])

let chart = null

onMounted(async () => {
  const [artRes, lowRes, rentRes, overdueRes, movRes] = await Promise.allSettled([
    api.get('/articles?limit=1'),
    api.get('/notifications/low-stock'),
    api.get('/rentals?active=1&limit=50'),
    api.get('/rentals?overdue=1&limit=1'),
    api.get(`/movements?from=${lastNDays(7)[0]}T00:00:00Z&limit=500`),
  ])

  if (artRes.status === 'fulfilled')
    statCards.value[0].value = artRes.value.data.total

  if (lowRes.status === 'fulfilled') {
    lowStock.value = lowRes.value.data.articles
    statCards.value[1].value = lowRes.value.data.total
  }

  if (rentRes.status === 'fulfilled') {
    activeRentals.value = rentRes.value.data.rentals
    statCards.value[2].value = rentRes.value.data.total
  }

  if (overdueRes.status === 'fulfilled')
    statCards.value[3].value = overdueRes.value.data.total

  // Build chart
  const days = lastNDays(7)
  const inCounts  = new Array(7).fill(0)
  const outCounts = new Array(7).fill(0)

  if (movRes.status === 'fulfilled') {
    for (const m of movRes.value.data.movements) {
      const day = m.created_at.slice(0, 10)
      const idx = days.indexOf(day)
      if (idx < 0) continue
      if (m.type === 'in'  || m.type === 'rental_in')  inCounts[idx]++
      if (m.type === 'out' || m.type === 'rental_out') outCounts[idx]++
    }
  }

  const labels = days.map(d => new Date(d + 'T12:00:00').toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit' }))

  chart = new Chart(chartCanvas.value, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Eingang', data: inCounts,  backgroundColor: 'rgba(34,197,94,.7)',  borderRadius: 4 },
        { label: 'Ausgang', data: outCounts, backgroundColor: 'rgba(239,68,68,.7)',  borderRadius: 4 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#4A6080', font: { size: 11 } } },
      },
      scales: {
        x: { ticks: { color: '#4A6080', font: { size: 11 } }, grid: { color: 'rgba(42,48,53,.8)' } },
        y: { ticks: { color: '#4A6080', font: { size: 11 }, stepSize: 1 }, grid: { color: 'rgba(42,48,53,.8)' } },
      },
    },
  })
})

onUnmounted(() => chart?.destroy())
</script>
