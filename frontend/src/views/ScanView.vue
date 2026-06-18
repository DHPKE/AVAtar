<template>
  <component :is="layout">
    <div class="flex flex-col" style="min-height:100%; padding:16px; max-width:600px; margin:0 auto;">

      <!-- ── IDLE: barcode input ───────────────────────────────────────────── -->
      <template v-if="state === 'idle' || state === 'loading'">
        <div class="flex-1 flex flex-col justify-center gap-5 py-8">
          <div class="flex items-center justify-center gap-2">
            <div class="w-2 h-2 rounded-full transition-colors"
              :style="isScanning ? 'background:#22C55E' : 'background:var(--border)'"></div>
            <p class="text-sm font-medium" style="color:var(--muted);">Barcode scannen oder eingeben</p>
          </div>

          <div class="relative">
            <input
              ref="barcodeInput"
              v-model="barcode"
              type="text" inputmode="text"
              autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
              placeholder="Barcode / Artikelnummer"
              class="w-full text-center text-xl font-mono rounded-xl px-4 transition-colors"
              style="height:72px; background:var(--card); border:2px solid var(--border); color:var(--text); outline:none;"
              :disabled="state === 'loading'"
              @keydown.enter="doSearch"
              @focus="e => e.target.style.borderColor = 'var(--accent)'"
              @blur="e  => e.target.style.borderColor  = 'var(--border)'"
            />
            <div v-if="state === 'loading'" class="absolute inset-0 flex items-center justify-center rounded-xl">
              <div class="w-6 h-6 rounded-full border-2 animate-spin" style="border-color:var(--accent);border-top-color:transparent;" />
            </div>
          </div>

          <button
            class="w-full rounded-xl font-semibold text-lg active:opacity-70 transition-opacity"
            style="height:64px; background:var(--accent); color:#fff;"
            :style="!barcode.trim() || state==='loading' ? 'opacity:.4' : ''"
            :disabled="!barcode.trim() || state === 'loading'"
            @click="doSearch"
          >Suchen</button>

          <div v-if="errorMsg" class="rounded-xl px-4 py-3 text-sm text-center" style="background:rgba(239,68,68,.12);color:var(--error);">
            {{ errorMsg }}
          </div>
        </div>
      </template>

      <!-- ── ARTICLE: card + action buttons ──────────────────────────────────── -->
      <template v-if="state === 'article'">
        <div class="rounded-xl p-4 mb-5" style="background:var(--card);border:1px solid var(--border);">
          <span :class="`type-badge type-badge--${article.type} mb-3`">{{ typeLabel(article.type) }}</span>
          <h2 class="text-xl font-semibold leading-tight mb-1" style="color:var(--text);">{{ article.name }}</h2>
          <p class="text-sm font-mono mb-4" style="color:var(--muted);">{{ article.article_number }}</p>
          <div class="flex items-end gap-4">
            <div>
              <p class="text-xs mb-0.5" style="color:var(--muted);">Bestand</p>
              <p class="text-4xl font-bold leading-none" :style="`color:${stockColor}`">{{ stockDisplay }}</p>
            </div>
            <div v-if="article.location" class="mb-1">
              <p class="text-xs mb-0.5" style="color:var(--muted);">Lagerort</p>
              <p class="text-sm font-medium" style="color:var(--text);">{{ article.location }}</p>
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-3">
          <button class="w-full rounded-xl font-bold text-lg tracking-wide active:opacity-80 transition-opacity"
            style="height:72px;background:#EF4444;color:#fff;" @click="selectAction('out')">
            AUSGANG
          </button>
          <button class="w-full rounded-xl font-bold text-lg tracking-wide active:opacity-80 transition-opacity"
            style="height:72px;background:#22C55E;color:#fff;" @click="selectAction('in')">
            EINGANG
          </button>
          <button v-if="article.type === 'rental' && availableSerials.length"
            class="w-full rounded-xl font-bold text-lg tracking-wide active:opacity-80 transition-opacity"
            style="height:72px;background:#14B8A6;color:#fff;" @click="selectAction('rental_out')">
            VERLEIHEN
          </button>
        </div>

        <button class="mt-4 w-full text-sm py-3 rounded-xl" style="color:var(--muted);" @click="reset">
          ← Neuer Scan
        </button>
      </template>

      <!-- ── QUANTITY: stepper + confirm ─────────────────────────────────────── -->
      <template v-if="state === 'quantity' || state === 'submitting'">
        <div class="rounded-xl px-4 py-3 mb-5 text-center font-semibold text-base"
          :style="`background:${actionColor}22;color:${actionColor};`">
          {{ actionLabel }}  ·  {{ article.name }}
        </div>

        <!-- Serial picker (rental) -->
        <div v-if="selectedAction === 'rental_out'" class="mb-5">
          <p class="text-sm font-medium mb-2" style="color:var(--muted);">Seriennummer</p>
          <div class="flex flex-col gap-2">
            <button v-for="sn in availableSerials" :key="sn.id"
              class="w-full rounded-xl px-4 text-left font-mono text-sm active:opacity-70 transition-opacity"
              style="height:56px;"
              :style="selectedSerial?.id === sn.id
                ? 'background:rgba(0,143,208,.2);border:2px solid var(--accent);color:var(--accent);'
                : 'background:var(--card);border:2px solid var(--border);color:var(--text);'"
              @click="selectedSerial = sn">
              {{ sn.serial_number }}
            </button>
          </div>
        </div>

        <!-- Verliehen an (rental) -->
        <div v-if="selectedAction === 'rental_out'" class="mb-5">
          <p class="text-sm font-medium mb-2" style="color:var(--muted);">Verliehen an *</p>
          <input v-model="rentedTo" type="text" placeholder="Name / Firma"
            class="w-full rounded-xl px-4 text-base"
            style="height:56px;background:var(--card);border:2px solid var(--border);color:var(--text);outline:none;"
            @focus="e => e.target.style.borderColor='var(--accent)'"
            @blur="e  => e.target.style.borderColor='var(--border)'" />
        </div>

        <!-- Quantity stepper -->
        <div v-if="selectedAction !== 'rental_out'" class="flex items-center justify-center gap-4 mb-5">
          <button class="rounded-xl font-bold text-2xl active:opacity-70 flex items-center justify-center"
            style="width:64px;height:64px;background:var(--card);border:2px solid var(--border);color:var(--text);"
            @click="decrement">−</button>
          <div class="flex-1 text-center">
            <span class="text-5xl font-bold" style="color:var(--text);">{{ displayQty }}</span>
            <span class="text-lg ml-1" style="color:var(--muted);">{{ article.unit === 'meter' ? 'm' : 'Stk' }}</span>
          </div>
          <button class="rounded-xl font-bold text-2xl active:opacity-70 flex items-center justify-center"
            style="width:64px;height:64px;background:var(--card);border:2px solid var(--border);color:var(--text);"
            @click="increment">+</button>
        </div>

        <!-- Meter direct input -->
        <div v-if="article.unit === 'meter'" class="mb-4 flex items-center gap-2">
          <input v-model.number="meters" type="number" step="0.5" min="0.5"
            class="flex-1 rounded-xl px-4 text-center text-xl font-bold"
            style="height:56px;background:var(--card);border:2px solid var(--border);color:var(--text);outline:none;"
            @focus="e => e.target.style.borderColor='var(--accent)'"
            @blur="e  => e.target.style.borderColor='var(--border)'" />
          <span style="color:var(--muted);">Meter</span>
        </div>

        <!-- Reference -->
        <div class="mb-5">
          <p class="text-sm font-medium mb-2" style="color:var(--muted);">Referenz (optional)</p>
          <input v-model="reference" type="text" placeholder="Projektnr., Auftragsnr."
            class="w-full rounded-xl px-4 text-base"
            style="height:56px;background:var(--card);border:2px solid var(--border);color:var(--text);outline:none;"
            @focus="e => e.target.style.borderColor='var(--accent)'"
            @blur="e  => e.target.style.borderColor='var(--border)'" />
        </div>

        <!-- Confirm -->
        <button
          class="w-full rounded-xl font-bold text-lg tracking-wide transition-opacity active:opacity-80"
          style="height:64px;color:#fff;"
          :style="`background:${actionColor};${!canConfirm ? 'opacity:.4;' : ''}`"
          :disabled="!canConfirm"
          @click="doConfirm">
          <span v-if="state !== 'submitting'">{{ actionLabel }} BESTÄTIGEN</span>
          <span v-else class="flex items-center justify-center gap-2">
            <div class="w-5 h-5 rounded-full border-2 animate-spin" style="border-color:#fff;border-top-color:transparent;" />
            Wird gebucht…
          </span>
        </button>

        <div v-if="errorMsg" class="mt-4 rounded-xl px-4 py-3 text-sm text-center"
          style="background:rgba(239,68,68,.12);color:var(--error);">{{ errorMsg }}</div>

        <button class="mt-4 w-full text-sm py-3 rounded-xl" style="color:var(--muted);" @click="state = 'article'">
          ← Zurück
        </button>
      </template>

      <!-- ── SUCCESS ─────────────────────────────────────────────────────────── -->
      <template v-if="state === 'success'">
        <div class="flex-1 flex flex-col items-center justify-center gap-5 py-12">
          <div class="w-20 h-20 rounded-full flex items-center justify-center" style="background:rgba(34,197,94,.15);">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22C55E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <p class="text-2xl font-bold" style="color:#22C55E;">Gebucht</p>
          <p class="text-base text-center" style="color:var(--muted);">{{ successMsg }}</p>
          <button class="mt-4 w-full rounded-xl font-semibold text-lg" style="height:64px;background:var(--accent);color:#fff;" @click="reset">
            Neuer Scan
          </button>
        </div>
      </template>

    </div>
  </component>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import AppLayout   from '@/components/AppLayout.vue'
import StaffLayout from '@/components/StaffLayout.vue'
import { useAuthStore } from '@/stores/auth'
import api from '@/api/axios'
import { useBarcodeScanner } from '@/composables/useBarcodeScanner.js'

const auth   = useAuthStore()
const layout = computed(() => auth.hasMinRole('warehouse_manager') ? AppLayout : StaffLayout)

const state          = ref('idle')
const barcode        = ref('')
const article        = ref(null)
const selectedAction = ref(null)
const qty            = ref(1)
const meters         = ref(1.0)
const reference      = ref('')
const rentedTo       = ref('')
const selectedSerial = ref(null)
const errorMsg       = ref('')
const successMsg     = ref('')
const barcodeInput   = ref(null)

const availableSerials = computed(() => (article.value?.serials ?? []).filter(s => s.status === 'available'))
const stockDisplay     = computed(() => !article.value ? '—' : article.value.unit === 'meter' ? `${article.value.stock_meters} m` : `${article.value.stock_qty} Stk`)
const stockColor       = computed(() => {
  if (!article.value) return 'var(--text)'
  const low = article.value.unit === 'meter' ? article.value.stock_meters <= article.value.min_stock : article.value.stock_qty <= article.value.min_stock
  return low ? 'var(--error)' : '#22C55E'
})

const ACTION_META = { in: { label:'EINGANG', color:'#22C55E' }, out: { label:'AUSGANG', color:'#EF4444' }, rental_out: { label:'VERLEIHEN', color:'#14B8A6' } }
const actionLabel  = computed(() => ACTION_META[selectedAction.value]?.label ?? '')
const actionColor  = computed(() => ACTION_META[selectedAction.value]?.color ?? 'var(--accent)')
const displayQty   = computed(() => article.value?.unit === 'meter' ? meters.value : qty.value)

const canConfirm = computed(() => {
  if (state.value === 'submitting') return false
  if (selectedAction.value === 'rental_out') return !!selectedSerial.value && rentedTo.value.trim().length > 0
  return article.value?.unit === 'meter' ? meters.value > 0 : qty.value > 0
})

function typeLabel(t) { return { consumable:'Verbrauch', bundle:'Gebinde', equipment:'Gerät', rental:'Verleih', cable:'Kabel' }[t] ?? t }

async function doSearch() {
  const q = barcode.value.trim()
  if (!q) return
  state.value = 'loading'; errorMsg.value = ''
  try {
    const { data } = await api.get(`/articles/barcode/${encodeURIComponent(q)}`)
    article.value = data; state.value = 'article'
  } catch (err) {
    errorMsg.value = err.response?.data?.error ?? 'Artikel nicht gefunden'
    state.value = 'idle'
    await nextTick(); barcodeInput.value?.focus()
  }
}

function selectAction(action) {
  selectedAction.value = action; qty.value = 1; meters.value = 1.0
  rentedTo.value = ''; selectedSerial.value = availableSerials.value[0] ?? null
  errorMsg.value = ''; state.value = 'quantity'
}

function increment() { article.value?.unit === 'meter' ? (meters.value = Math.round((meters.value + 0.5)*10)/10) : qty.value++ }
function decrement() { article.value?.unit === 'meter' ? (meters.value > 0.5 && (meters.value = Math.round((meters.value - 0.5)*10)/10)) : (qty.value > 1 && qty.value--) }

async function doConfirm() {
  state.value = 'submitting'; errorMsg.value = ''
  try {
    if (selectedAction.value === 'rental_out') {
      await api.post('/rentals', { serial_number_id: selectedSerial.value.id, rented_to: rentedTo.value.trim() })
      successMsg.value = `${article.value.name} verliehen an ${rentedTo.value.trim()}`
    } else {
      await api.post('/movements', {
        article_id: article.value.id, type: selectedAction.value,
        qty: article.value.unit !== 'meter' ? qty.value : 0,
        meters: article.value.unit === 'meter' ? meters.value : 0,
        reference: reference.value.trim() || undefined,
      })
      const amt = article.value.unit === 'meter' ? `${meters.value} m` : `${qty.value} Stk`
      successMsg.value = `${article.value.name} · ${actionLabel.value} ${amt}`
    }
    state.value = 'success'
  } catch (err) {
    errorMsg.value = err.response?.data?.error ?? 'Buchung fehlgeschlagen'
    state.value = 'quantity'
  }
}

function reset() {
  Object.assign({ state, barcode, article, selectedAction, errorMsg, successMsg, reference, rentedTo, selectedSerial },
    { state: 'idle', barcode: '', article: null, selectedAction: null, errorMsg: '', successMsg: '', reference: '', rentedTo: '', selectedSerial: null })
  state.value = 'idle'; barcode.value = ''; article.value = null; selectedAction.value = null
  errorMsg.value = ''; successMsg.value = ''; reference.value = ''; rentedTo.value = ''; selectedSerial.value = null
  qty.value = 1; meters.value = 1.0
  nextTick(() => barcodeInput.value?.focus())
}

// Register scanner composable — handles focus lock + scanner-speed detection
// active=false when not in idle state so other inputs work normally
const scanActive = computed(() => state.value === 'idle')
const { isScanning } = useBarcodeScanner(barcodeInput, (code) => {
  barcode.value = code
  doSearch()
}, { active: scanActive })

onMounted(() => nextTick(() => barcodeInput.value?.focus()))
</script>
