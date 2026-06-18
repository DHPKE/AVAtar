<template>
  <AppLayout>
    <div class="p-5 max-w-2xl mx-auto flex flex-col gap-5">
      <h1 class="text-xl font-semibold" style="color:var(--text);">Einstellungen</h1>

      <!-- SMTP Status -->
      <div class="rounded-xl p-5" style="background:var(--card);border:1px solid var(--border);">
        <h2 class="text-sm font-semibold mb-4" style="color:var(--text);">E-Mail / SMTP</h2>
        <div class="flex items-center gap-3 mb-4">
          <div class="w-2 h-2 rounded-full flex-shrink-0"
            :style="smtpOk === null ? 'background:var(--muted)' : smtpOk ? 'background:#22C55E' : 'background:var(--error)'" />
          <span class="text-sm" style="color:var(--muted);">
            {{ smtpOk === null ? 'Ungeprüft' : smtpOk ? 'Verbindung OK' : smtpError }}
          </span>
          <button class="ml-auto text-xs px-3 py-1.5 rounded-lg" style="background:var(--surface);border:1px solid var(--border);color:var(--text);"
            :disabled="testingSmtp" @click="testSmtp">
            {{ testingSmtp ? 'Prüfe…' : 'Verbindung testen' }}
          </button>
        </div>
        <div>
          <label class="block text-xs font-medium mb-1" style="color:var(--muted);">Benachrichtigungs-E-Mail</label>
          <div class="flex gap-2">
            <input v-model="notifyEmail" type="email" placeholder="lager@example.com"
              class="flex-1 rounded-lg px-3 text-sm"
              style="height:40px;background:var(--surface);border:1px solid var(--border);color:var(--text);outline:none;" />
            <button class="px-4 rounded-lg text-sm font-medium" style="background:var(--accent);color:#fff;"
              :disabled="savingEmail" @click="saveNotifyEmail">
              {{ savingEmail ? '…' : 'Speichern' }}
            </button>
          </div>
          <p class="text-xs mt-1" style="color:var(--muted);">Empfänger für Mindestbestand-Warnungen</p>
        </div>
        <div v-if="emailMsg" class="mt-3 text-xs rounded-lg px-3 py-2"
          :style="emailMsg.ok ? 'background:rgba(34,197,94,.12);color:#22C55E;' : 'background:rgba(239,68,68,.12);color:var(--error);'">
          {{ emailMsg.text }}
        </div>
      </div>

      <!-- Manual low-stock check -->
      <div class="rounded-xl p-5" style="background:var(--card);border:1px solid var(--border);">
        <h2 class="text-sm font-semibold mb-2" style="color:var(--text);">Mindestbestand-Check</h2>
        <p class="text-xs mb-4" style="color:var(--muted);">Prüft sofort alle Bestände und sendet eine E-Mail falls Artikel unter Minimum sind.</p>
        <button class="rounded-lg px-4 text-sm font-medium" style="height:40px;background:var(--surface);border:1px solid var(--border);color:var(--text);"
          :disabled="runningCheck" @click="runCheck">
          {{ runningCheck ? 'Prüfe…' : 'Jetzt prüfen & E-Mail senden' }}
        </button>
        <div v-if="checkResult" class="mt-3 text-xs rounded-lg px-3 py-2"
          :style="checkResult.ok ? 'background:rgba(34,197,94,.12);color:#22C55E;' : 'background:rgba(245,158,11,.12);color:#F59E0B;'">
          {{ checkResult.text }}
        </div>
      </div>

      <!-- Change own password -->
      <div class="rounded-xl p-5" style="background:var(--card);border:1px solid var(--border);">
        <h2 class="text-sm font-semibold mb-4" style="color:var(--text);">Eigenes Passwort ändern</h2>
        <div class="flex flex-col gap-3">
          <input v-model="currentPw" type="password" placeholder="Aktuelles Passwort"
            class="w-full rounded-lg px-3 text-sm" style="height:40px;background:var(--surface);border:1px solid var(--border);color:var(--text);outline:none;" />
          <input v-model="newPw" type="password" placeholder="Neues Passwort (min. 8 Zeichen)"
            class="w-full rounded-lg px-3 text-sm" style="height:40px;background:var(--surface);border:1px solid var(--border);color:var(--text);outline:none;" />
          <button class="w-full rounded-lg text-sm font-semibold" style="height:44px;background:var(--accent);color:#fff;"
            :style="!canChangePw ? 'opacity:.4' : ''"
            :disabled="!canChangePw || changingPw" @click="changePw">
            {{ changingPw ? 'Wird geändert…' : 'Passwort ändern' }}
          </button>
          <div v-if="pwMsg" class="text-xs rounded-lg px-3 py-2"
            :style="pwMsg.ok ? 'background:rgba(34,197,94,.12);color:#22C55E;' : 'background:rgba(239,68,68,.12);color:var(--error);'">
            {{ pwMsg.text }}
          </div>
        </div>
      </div>

      <!-- System info -->
      <div class="rounded-xl p-5" style="background:var(--card);border:1px solid var(--border);">
        <h2 class="text-sm font-semibold mb-3" style="color:var(--text);">System</h2>
        <div class="grid grid-cols-2 gap-3 text-xs" style="color:var(--muted);">
          <div>Version<p class="font-medium mt-0.5" style="color:var(--text);">0.1.0</p></div>
          <div>Artikel<p class="font-medium mt-0.5" style="color:var(--text);">{{ sysInfo.articles }}</p></div>
          <div>Bewegungen<p class="font-medium mt-0.5" style="color:var(--text);">{{ sysInfo.movements }}</p></div>
          <div>Benutzer<p class="font-medium mt-0.5" style="color:var(--text);">{{ sysInfo.users }}</p></div>
        </div>
      </div>

      <!-- Scanner settings -->
      <div class="rounded-xl p-5" style="background:var(--card);border:1px solid var(--border);">
        <h2 class="text-sm font-semibold mb-1" style="color:var(--text);">Barcode-Scanner</h2>
        <p class="text-xs mb-4" style="color:var(--muted);">
          Gilt für USB-HID und Bluetooth-HID Scanner (Zebra, Honeywell, Datalogic, …).
          Scanner arbeiten im Keyboard-Modus — kein Treiber erforderlich.
        </p>
        <div class="flex flex-col gap-4">

          <div>
            <label class="block text-xs font-medium mb-1" style="color:var(--muted);">Abschlusszeichen (Terminator)</label>
            <select v-model="scanner.terminator"
              class="w-full rounded-lg px-3 text-sm"
              style="height:40px;background:var(--surface);border:1px solid var(--border);color:var(--text);outline:none;">
              <option value="Enter">Enter (Standard — Zebra, Honeywell, Datalogic)</option>
              <option value="Tab">Tab (selten)</option>
              <option value="Ctrl+J">Ctrl+J (ältere Scanner)</option>
              <option value="none">Keins — automatisch nach Pause</option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium mb-1" style="color:var(--muted);">Min. Zeichen</label>
              <input v-model.number="scanner.minLength" type="number" min="1" max="20"
                class="w-full rounded-lg px-3 text-sm"
                style="height:40px;background:var(--surface);border:1px solid var(--border);color:var(--text);outline:none;" />
            </div>
            <div>
              <label class="block text-xs font-medium mb-1" style="color:var(--muted);">Max. Intervall (ms)</label>
              <input v-model.number="scanner.maxInterval" type="number" min="10" max="200"
                class="w-full rounded-lg px-3 text-sm"
                style="height:40px;background:var(--surface);border:1px solid var(--border);color:var(--text);outline:none;" />
              <p class="text-xs mt-1" style="color:var(--muted);">Tastendruck-Abstand für Scanner-Erkennung</p>
            </div>
          </div>

          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" v-model="scanner.focusLock" />
            <span class="text-sm" style="color:var(--text);">Focus-Lock aktiv</span>
            <span class="text-xs ml-1" style="color:var(--muted);">— Scan-Eingabe bleibt immer fokussiert</span>
          </label>

          <div v-if="scannerSaved" class="text-xs rounded-lg px-3 py-2" style="background:rgba(34,197,94,.12);color:#22C55E;">
            Scanner-Einstellungen gespeichert
          </div>

          <button class="w-full rounded-lg text-sm font-semibold" style="height:40px;background:var(--accent);color:#fff;"
            @click="saveScanner">Speichern</button>
        </div>
      </div>

      <!-- CSV Export -->
      <div class="rounded-xl p-5" style="background:var(--card);border:1px solid var(--border);">
        <h2 class="text-sm font-semibold mb-3" style="color:var(--text);">CSV-Export</h2>
        <div class="flex flex-wrap gap-2">
          <a href="/api/export/articles.csv"
            class="rounded-lg px-3 text-sm font-medium flex items-center"
            style="height:36px;background:var(--surface);border:1px solid var(--border);color:var(--text);">
            ↓ Artikel
          </a>
          <a href="/api/export/movements.csv"
            class="rounded-lg px-3 text-sm font-medium flex items-center"
            style="height:36px;background:var(--surface);border:1px solid var(--border);color:var(--text);">
            ↓ Bewegungen
          </a>
          <a href="/api/export/rentals.csv"
            class="rounded-lg px-3 text-sm font-medium flex items-center"
            style="height:36px;background:var(--surface);border:1px solid var(--border);color:var(--text);">
            ↓ Verleihe
          </a>
        </div>
        <p class="text-xs mt-2" style="color:var(--muted);">Excel-kompatibel (UTF-8 BOM)</p>
      </div>

    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import AppLayout from '@/components/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'
import api from '@/api/axios'

const auth = useAuthStore()

const smtpOk      = ref(null)
const smtpError   = ref('')
const testingSmtp = ref(false)
const notifyEmail = ref('')
const savingEmail = ref(false)
const emailMsg    = ref(null)
const runningCheck = ref(false)
const checkResult  = ref(null)
const currentPw   = ref('')
const newPw       = ref('')
const changingPw  = ref(false)
const pwMsg       = ref(null)
const sysInfo     = ref({ articles:'—', movements:'—', users:'—' })

const canChangePw = computed(() => currentPw.value.length > 0 && newPw.value.length >= 8)

onMounted(async () => {
  const [settingsRes, healthRes] = await Promise.allSettled([
    api.get('/settings'),
    api.get('/health'),
  ])
  if (settingsRes.status === 'fulfilled') notifyEmail.value = settingsRes.value.data.settings.notify_email || ''
  if (healthRes.status === 'fulfilled') {
    const db = healthRes.value.data.db
    sysInfo.value = { articles: db.articles, movements: db.movements, users: db.users }
  }
})

async function testSmtp() {
  testingSmtp.value = true; smtpOk.value = null
  try {
    const { data } = await api.get('/settings/smtp-test')
    smtpOk.value = data.ok; smtpError.value = data.error || ''
  } finally { testingSmtp.value = false }
}

async function saveNotifyEmail() {
  savingEmail.value = true; emailMsg.value = null
  try {
    await api.put('/settings/notify_email', { value: notifyEmail.value })
    emailMsg.value = { ok: true, text: 'Gespeichert' }
  } catch (err) { emailMsg.value = { ok:false, text: err.response?.data?.error ?? 'Fehler' } }
  finally { savingEmail.value = false }
}

async function runCheck() {
  runningCheck.value = true; checkResult.value = null
  try {
    const { data } = await api.post('/notifications/check', { notify_email: notifyEmail.value || undefined })
    checkResult.value = data.low_stock_count === 0
      ? { ok:true,  text:'Alle Bestände OK — keine E-Mail gesendet' }
      : { ok:false, text:`${data.low_stock_count} Artikel unter Minimum — E-Mail ${data.sent ? 'gesendet' : 'übersprungen (kein SMTP)'}` }
  } finally { runningCheck.value = false }
}

async function changePw() {
  changingPw.value = true; pwMsg.value = null
  try {
    await auth.changePassword(currentPw.value, newPw.value)
    pwMsg.value = { ok:true, text:'Passwort erfolgreich geändert' }
    currentPw.value = ''; newPw.value = ''
  } catch (err) { pwMsg.value = { ok:false, text: err.response?.data?.error ?? 'Fehler' } }
  finally { changingPw.value = false }
}

// ── Scanner settings ─────────────────────────────────────────────────────────
import { loadScannerSettings, saveScannerSettings } from '@/composables/useBarcodeScanner.js'
const scanner     = ref(loadScannerSettings())
const scannerSaved = ref(false)

function saveScanner() {
  saveScannerSettings(scanner.value)
  scannerSaved.value = true
  setTimeout(() => { scannerSaved.value = false }, 2000)
}
</script>
