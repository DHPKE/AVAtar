/**
 * useBarcodeScanner
 *
 * Turns any text input into a scanner-aware field that works with both
 * USB HID and Bluetooth HID barcode scanners (all major brands on HID mode).
 *
 * How scanners work (USB + Bluetooth):
 *   - Scanner pairs/plugs in as a keyboard (HID device)
 *   - Sends characters very fast (~5–20 ms apart)
 *   - Ends with a configurable terminator (default: Enter)
 *   - Compared to human typing (~100–300 ms between keys)
 *
 * Features:
 *   1. Focus lock   — stray keystrokes redirect to the target input even if
 *                     the user has accidentally tapped/clicked elsewhere
 *   2. Speed filter — distinguishes scanner (fast) from manual typing (slow)
 *   3. Terminator   — configurable: Enter | Tab | Ctrl+J | none (auto-flush)
 *   4. Persistence  — settings stored in localStorage
 */

import { ref, onMounted, onUnmounted } from 'vue'

// ─── Settings helpers ─────────────────────────────────────────────────────────

const STORAGE_KEY = 'avatar_scanner_cfg'

export const SCANNER_DEFAULTS = {
  terminator:   'Enter', // 'Enter' | 'Tab' | 'Ctrl+J' | 'none'
  minLength:    3,       // minimum chars to be considered a valid scan
  maxInterval:  50,      // ms — keystrokes ≤ this = scanner; > this = human
  focusLock:    true,    // redirect stray keystrokes to the scan input
}

export function loadScannerSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return { ...SCANNER_DEFAULTS, ...stored }
  } catch {
    return { ...SCANNER_DEFAULTS }
  }
}

export function saveScannerSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...SCANNER_DEFAULTS, ...settings }))
}

// ─── Composable ───────────────────────────────────────────────────────────────

/**
 * @param {import('vue').Ref<HTMLInputElement|null>} inputRef
 *   The target <input> element ref. The composable manages focus + scanning.
 *
 * @param {(code: string) => void} onScan
 *   Called when a complete scan code is received.
 *
 * @param {{ active?: import('vue').Ref<boolean> }} [options]
 *   active — reactive gate; set to false to disable the composable temporarily.
 *            Useful when the scan input is not visible (e.g. quantity step).
 */
export function useBarcodeScanner(inputRef, onScan, { active } = {}) {
  const cfg        = loadScannerSettings()
  const isScanning = ref(false)    // true while scanner-speed input is in progress

  let buffer      = ''
  let lastKeyTime = 0
  let clearTimer  = null

  // ── Helpers ────────────────────────────────────────────────────────────────

  function isActive() {
    return !active || active.value !== false
  }

  function isTerminator(e) {
    if (cfg.terminator === 'Enter'  && e.key === 'Enter')                       return true
    if (cfg.terminator === 'Tab'    && e.key === 'Tab')                         return true
    if (cfg.terminator === 'Ctrl+J' && e.key === 'j' && e.ctrlKey)             return true
    return false
  }

  function flush() {
    clearTimeout(clearTimer)
    const code   = buffer
    buffer       = ''
    isScanning.value = false
    if (code.length >= cfg.minLength) onScan(code.trim())
  }

  // ── Global keydown handler ─────────────────────────────────────────────────

  function handleKeydown(e) {
    if (!isActive()) return

    const now = Date.now()
    const dt  = now - lastKeyTime
    lastKeyTime = now

    // ── Terminator received ────────────────────────────────────────────────
    if (isTerminator(e)) {
      if (buffer.length >= cfg.minLength) {
        e.preventDefault()
        flush()
      } else {
        // Short buffer + Enter = normal form submit from manual input;
        // let it propagate so the input's own @keydown.enter fires
      }
      return
    }

    // Skip non-printable keys and modifier combinations
    if (e.key.length !== 1 || e.ctrlKey || e.altKey || e.metaKey) return

    // ── Focus lock ─────────────────────────────────────────────────────────
    if (cfg.focusLock && inputRef.value) {
      const focused = document.activeElement
      if (focused !== inputRef.value && !['INPUT','TEXTAREA','SELECT'].includes(focused?.tagName)) {
        inputRef.value.focus()
        // Don't preventDefault — the character will land in the now-focused input
        return
      }
    }

    // ── Buffer management ──────────────────────────────────────────────────
    // Long gap between keystrokes = manual typing between scanner events; reset
    if (dt > 500 && buffer.length > 0) {
      buffer       = ''
      isScanning.value = false
    }

    // Mark as scanner-speed input
    if (dt <= cfg.maxInterval && buffer.length >= 1) isScanning.value = true

    buffer += e.key

    // Auto-flush after silence (handles scanners without a terminator configured)
    clearTimeout(clearTimer)
    clearTimer = setTimeout(() => {
      if (cfg.terminator === 'none' && buffer.length >= cfg.minLength && isScanning.value) {
        flush()
      } else {
        // Incomplete buffer — discard silently
        buffer       = ''
        isScanning.value = false
      }
    }, 200)
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  onMounted(() => {
    document.addEventListener('keydown', handleKeydown, true) // capture phase — fires first
    // Initial focus
    setTimeout(() => inputRef.value?.focus(), 50)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown, true)
    clearTimeout(clearTimer)
  })

  return { isScanning }
}
