<template>
  <component :is="layout">
    <div class="flex flex-col" style="min-height:100%; padding:16px; max-width:680px; margin:0 auto;">

      <!-- ── Scan input — always visible at top ──────────────────────────────── -->
      <div class="mb-4">
        <div class="flex items-center justify-center gap-2 mb-2">
          <div class="w-2 h-2 rounded-full transition-colors"
            :style="isScanning ? 'background:#22C55E' : 'background:var(--border)'"></div>
          <p class="text-sm font-medium" style="color:var(--muted);">Artikel scannen zum Hinzufügen</p>
        </div>
        <div class="relative">
          <input
            ref="barcodeInput"
            v-model="barcode"
            type="text" inputmode="text"
            autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
            placeholder="Barcode / Artikelnummer"
            class="w-full text-center text-lg font-mono rounded-xl px-4 transition-colors"
            style="height:60px; background:var(--card); border:2px solid var(--border); color:var(--text); outline:none;"
            :disabled="searching"
            @keydown.enter="doSearch"
            @focus="e => e.target.style.borderColor='var(--accent)'"
            @blur="e  => e.target.style.borderColor='var(--border)'"
          />
          <div v-if="searching" class="absolute inset-0 flex items-center justify-center rounded-xl">
            <div class="w-5 h-5 rounded-full border-2 animate-spin" style="border-color:var(--accent);border-top-color:transparent;" />
          </div>
        </div>
        <div v-if="scanError" class="mt-2 rounded-lg px-3 py-2 text-sm text-center" style="background:rgba(239,68,68,.12);color:var(--error);">
          {{ scanError }}
        </div>
      </div>

      <!-- ── Pending item: type + quantity selector right after scan ─────────── -->
      <div v-if="pendingArticle" class="rounded-xl p-4 mb-4" style="background:var(--card);border:2px solid var(--accent);">
        <div class="flex items-center justify-between mb-3">
          <div>
            <p class="text-sm font-semibold" style="color:var(--text);">{{ pendingArticle.name }}</p>
            <p class="text-xs font-mono" style="color:var(--muted);">{{ pendingArticle.article_number }} · Bestand: {{ fmtStock(pendingArticle) }}</p>
          </div>
          <button class="text-sm" style="color:var(--muted);" @click="pendingArticle = null">×</button>
        </div>

        <!-- Type toggle -->
        <div class="flex gap-2 mb-3">
          <button v-for="t in ['out','in']" :key="t"
            class="flex-1 rounded-lg py-2.5 text-sm font-bold transition-opacity active:opacity-80"
            :style="pendingType === t
              ? `background:${t === 'out' ? '#EF4444' : '#22C55E'};color:#fff;`
              : 'background:var(--surface);border:1px solid var(--border);color:var(--muted);'"
            @click="pendingType = t">
            {{ t === 'out' ? 'AUSGANG' : 'EINGANG' }}
          </button>
        </div>

        <!-- Quantity stepper -->
        <div class="flex items-center justify-center gap-3 mb-3">
          <button class="rounded-lg font-bold text-xl active:opacity-70 flex items-center justify-center"
            style="width:48px;height:48px;background:var(--surface);border:1px solid var(--border);color:var(--text);"
            @click="decrementPending">−</button>
          <div class="flex-1 text-center">
            <span class="text-3xl font-bold" style="color:var(--text);">{{ pendingDisplayAmount }}</span>
            <span class="text-sm ml-1" style="color:var(--muted);">{{ pendingArticle.unit === 'meter' ? 'm' : 'Stk' }}</span>
          </div>
          <button class="rounded-lg font-bold text-xl active:opacity-70 flex items-center justify-center"
            style="width:48px;height:48px;background:var(--surface);border:1px solid var(--border);color:var(--text);"
            @click="incrementPending">+</button>
        </div>

        <!-- Reference -->
        <input v-model="pendingReference" type="text" placeholder="Referenz (optional)"
          class="w-full rounded-lg px-3 text-sm mb-3"
          style="height:44px;background:var(--surface);border:1px solid var(--border);color:var(--text);outline:none;" />

        <button class="w-full rounded-lg font-semibold text-sm"
          style="height:48px;background:var(--accent);color:#fff;"
          @click="addPendingToCart">
          Zum Warenkorb hinzufügen
        </button>
      </div>

      <!-- ── Cart ──────────────────────────────────────────────────────────────── -->
      <div class="flex items-center justify-between mb-2 mt-2">
        <p class="text-sm font-semibold" style="color:var(--text);">
          Warenkorb
          <span v-if="cart.count" class="ml-1 text-xs px-1.5 py-0.5 rounded" style="background:rgba(0,143,208,.15);color:var(--accent);">{{ cart.count }}</span>
        </p>
        <button v-if="cart.count" class="text-xs" style="color:var(--muted);" @click="confirmClear">Alles leeren</button>
      </div>

      <div v-if="cart.isEmpty" class="rounded-xl py-10 text-center text-sm" style="background:var(--card);border:1px dashed var(--border);color:var(--muted);">
        Warenkorb leer — Artikel scannen, um zu beginnen
      </div>

      <div v-else class="flex flex-col gap-2 mb-4">
        <div v-for="item in cart.items" :key="item.uid"
          class="rounded-xl p-3"
          :style="item.error
            ? 'background:var(--card);border:1.5px solid var(--error);'
            : 'background:var(--card);border:1px solid var(--border);'">

          <div class="flex items-start justify-between gap-2 mb-2">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold px-1.5 py-0.5 rounded"
                  :style="item.type === 'out' ? 'background:rgba(239,68,68,.15);color:#EF4444;' : 'background:rgba(34,197,94,.15);color:#22C55E;'">
                  {{ item.type === 'out' ? 'AUSGANG' : 'EINGANG' }}
                </span>
                <p class="text-sm font-medium truncate" style="color:var(--text);">{{ item.article_name }}</p>
              </div>
              <p class="text-xs font-mono mt-0.5" style="color:var(--muted);">{{ item.article_number }}</p>
            </div>
            <button class="text-lg leading-none flex-shrink-0" style="color:var(--muted);" @click="cart.removeItem(item.uid)">×</button>
          </div>

          <!-- Inline qty stepper -->
          <div class="flex items-center gap-2">
            <button class="rounded font-bold text-sm active:opacity-70 flex items-center justify-center"
              style="width:32px;height:32px;background:var(--surface);border:1px solid var(--border);color:var(--text);"
              @click="adjustCartItem(item, -1)">−</button>
            <span class="text-sm font-semibold w-16 text-center" style="color:var(--text);">
              {{ item.unit === 'meter' ? item.meters + ' m' : item.qty + ' Stk' }}
            </span>
            <button class="rounded font-bold text-sm active:opacity-70 flex items-center justify-center"
              style="width:32px;height:32px;background:var(--surface);border:1px solid var(--border);color:var(--text);"
              @click="adjustCartItem(item, 1)">+</button>
            <input v-model="item.reference" @input="cart.updateItem(item.uid, { reference: item.reference })"
              type="text" placeholder="Referenz"
              class="flex-1 rounded px-2 text-xs"
              style="height:32px;background:var(--surface);border:1px solid var(--border);color:var(--text);outline:none;" />
          </div>

          <div v-if="item.error" class="mt-2 text-xs rounded px-2 py-1.5" style="background:rgba(239,68,68,.1);color:var(--error);">
            {{ item.error }}
          </div>
        </div>
      </div>

      <!-- ── Book button ──────────────────────────────────────────────────────── -->
      <button
        v-if="!cart.isEmpty"
        class="w-full rounded-xl font-bold text-lg tracking-wide transition-opacity active:opacity-80 sticky bottom-4"
        style="height:64px; background:var(--accent); color:#fff;"
        :style="booking ? 'opacity:.6' : ''"
        :disabled="booking"
        @click="doBook"
      >
        <span v-if="!booking">Artikel buchen ({{ cart.count }})</span>
        <span v-else class="flex items-center justify-center gap-2">
          <div class="w-5 h-5 rounded-full border-2 animate-spin" style="border-color:#fff;border-top-color:transparent;" />
          Wird gebucht…
        </span>
      </button>

      <div v-if="bookError" class="mt-3 rounded-xl px-4 py-3 text-sm text-center" style="background:rgba(239,68,68,.12);color:var(--error);">
        {{ bookError }}
      </div>

      <!-- ── Success overlay ──────────────────────────────────────────────────── -->
      <Teleport to="body">
        <div v-if="showSuccess" class="fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(0,0,0,.6);">
          <div class="rounded-xl p-8 flex flex-col items-center gap-4 mx-4" style="background:var(--card);border:1px solid var(--border);max-width:360px;">
            <div class="w-16 h-16 rounded-full flex items-center justify-center" style="background:rgba(34,197,94,.15);">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22C55E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <p class="text-xl font-bold" style="color:#22C55E;">{{ successCount }} Artikel gebucht</p>
            <button class="w-full rounded-xl font-semibold text-base" style="height:52px;background:var(--accent);color:#fff;" @click="showSuccess = false">
              Weiter
            </button>
          </div>
        </div>
      </Teleport>

    </div>
  </component>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import AppLayout   from '@/components/AppLayout.vue'
import StaffLayout from '@/components/StaffLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { useBarcodeScanner } from '@/composables/useBarcodeScanner.js'
import api from '@/api/axios'
import { fmtStock } from '@/utils/labels.js'

const auth   = useAuthStore()
const cart   = useCartStore()
const layout = computed(() => auth.hasMinRole('warehouse_manager') ? AppLayout : StaffLayout)

const barcode        = ref('')
const barcodeInput    = ref(null)
const searching       = ref(false)
const scanError       = ref('')
const pendingArticle  = ref(null)
const pendingType     = ref('out')
const pendingQty      = ref(1)
const pendingMeters   = ref(1.0)
const pendingReference = ref('')
const booking         = ref(false)
const bookError       = ref('')
const showSuccess     = ref(false)
const successCount    = ref(0)

// Scanner stays active even with a pending article showing —
// staff can keep scanning to queue items rapidly without finishing the dialog
const scanActive = computed(() => true)
const { isScanning } = useBarcodeScanner(barcodeInput, (code) => {
  barcode.value = code
  doSearch()
}, { active: scanActive })

const pendingDisplayAmount = computed(() =>
  pendingArticle.value?.unit === 'meter' ? pendingMeters.value : pendingQty.value
)

async function doSearch() {
  const q = barcode.value.trim()
  if (!q) return
  searching.value = true
  scanError.value  = ''
  try {
    const { data } = await api.get(`/articles/barcode/${encodeURIComponent(q)}`)
    pendingArticle.value   = data
    pendingType.value      = 'out'
    pendingQty.value       = 1
    pendingMeters.value    = 1.0
    pendingReference.value = ''
    barcode.value = ''
  } catch (err) {
    scanError.value = err.response?.data?.error ?? 'Artikel nicht gefunden'
    barcode.value = ''
  } finally {
    searching.value = false
    nextTick(() => barcodeInput.value?.focus())
  }
}

function incrementPending() {
  if (pendingArticle.value?.unit === 'meter') pendingMeters.value = Math.round((pendingMeters.value + 0.5) * 10) / 10
  else pendingQty.value++
}
function decrementPending() {
  if (pendingArticle.value?.unit === 'meter') { if (pendingMeters.value > 0.5) pendingMeters.value = Math.round((pendingMeters.value - 0.5) * 10) / 10 }
  else { if (pendingQty.value > 1) pendingQty.value-- }
}

function addPendingToCart() {
  if (!pendingArticle.value) return
  const amount = pendingArticle.value.unit === 'meter' ? pendingMeters.value : pendingQty.value
  cart.addItem(pendingArticle.value, pendingType.value, amount, pendingReference.value)
  pendingArticle.value = null
  nextTick(() => barcodeInput.value?.focus())
}

function adjustCartItem(item, delta) {
  if (item.unit === 'meter') {
    const next = Math.max(0.5, Math.round((item.meters + delta * 0.5) * 10) / 10)
    cart.updateItem(item.uid, { meters: next })
  } else {
    const next = Math.max(1, item.qty + delta)
    cart.updateItem(item.uid, { qty: next })
  }
}

function confirmClear() {
  if (confirm('Warenkorb wirklich leeren?')) cart.clear()
}

async function doBook() {
  booking.value   = true
  bookError.value = ''
  // Clear previous per-item errors
  cart.items.forEach(i => { i.error = null })

  try {
    const { data } = await api.post('/movements/batch', { items: cart.toBatchPayload() })
    successCount.value = data.booked
    showSuccess.value  = true
    cart.clear()
  } catch (err) {
    const resData = err.response?.data
    bookError.value = resData?.error ?? 'Buchung fehlgeschlagen'
    if (resData?.failedIndex !== undefined && cart.items[resData.failedIndex]) {
      cart.setError(cart.items[resData.failedIndex].uid, resData.error)
    }
  } finally {
    booking.value = false
  }
}

onMounted(() => nextTick(() => barcodeInput.value?.focus()))
</script>
