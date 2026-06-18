/**
 * Pure functions for managing a numeric entry buffer driven by an
 * on-screen numpad. Kept framework-free and side-effect-free so they're
 * trivially testable and reusable across ScanView, BookingView, and any
 * future numpad-driven input.
 */

/**
 * Appends a digit (or decimal point) to the buffer, respecting
 * maxLength and decimal-point rules.
 *
 * @param {string} buffer
 * @param {string} digit        — '0'-'9' or '.'
 * @param {{ allowDecimal?: boolean, maxLength?: number }} [opts]
 * @returns {string} the new buffer
 */
export function appendDigit(buffer, digit, opts = {}) {
  const { allowDecimal = false, maxLength = 8 } = opts

  if (digit === '.') {
    if (!allowDecimal) return buffer
    if (buffer.includes('.')) return buffer // only one decimal point
  }

  if (buffer.length >= maxLength) return buffer

  // Avoid multiple leading zeros like "00"
  if (buffer === '0' && digit !== '.') return digit

  return buffer + digit
}

/** Removes the last character from the buffer. */
export function backspace(buffer) {
  return buffer.slice(0, -1)
}

/**
 * Parses a buffer into a number. Returns 0 for empty/invalid input
 * rather than NaN, so callers can validate with a simple `> 0` check.
 */
export function parseAmount(buffer) {
  const n = parseFloat(buffer)
  return Number.isFinite(n) ? n : 0
}

/** Formats a starting amount (number) into a fresh buffer string. */
export function toBuffer(amount) {
  return String(Number(amount))
}
