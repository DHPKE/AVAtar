import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const STORAGE_KEY = 'avatar_cart'

/**
 * Cart item shape:
 *   {
 *     uid:          string   — local unique id (not a DB id)
 *     article_id:   number
 *     article_name: string
 *     article_number: string
 *     unit:         'piece' | 'meter' | 'bundle'
 *     type:         'in' | 'out' | 'correction'
 *     qty:          number   — for piece/bundle articles
 *     meters:       number   — for cable articles
 *     reference:    string
 *     error:        string|null  — set after a failed booking attempt
 *   }
 */

function loadPersisted() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function persist(items) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

let uidCounter = 0
function nextUid() {
  uidCounter += 1
  return `cart-${Date.now()}-${uidCounter}`
}

export const useCartStore = defineStore('cart', () => {
  // ── State ───────────────────────────────────────────────────────────────────
  const items = ref(loadPersisted())

  // ── Getters ─────────────────────────────────────────────────────────────────
  const count    = computed(() => items.value.length)
  const isEmpty  = computed(() => items.value.length === 0)

  // ── Internal ────────────────────────────────────────────────────────────────
  function _save() {
    persist(items.value)
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  /**
   * Adds an article to the cart. If an item with the same article_id + type
   * already exists, merges by summing the quantity instead of duplicating.
   */
  function addItem(article, type, amount, reference = '') {
    const isCable = article.unit === 'meter'

    const existing = items.value.find(
      i => i.article_id === article.id && i.type === type && (i.reference || '') === (reference || '')
    )

    if (existing) {
      if (isCable) existing.meters = Math.round((existing.meters + amount) * 10) / 10
      else         existing.qty    = existing.qty + amount
      existing.error = null
    } else {
      items.value.push({
        uid:            nextUid(),
        article_id:     article.id,
        article_name:   article.name,
        article_number: article.article_number,
        unit:           article.unit,
        type,
        qty:            isCable ? 0 : amount,
        meters:         isCable ? amount : 0,
        reference:      reference || '',
        error:          null,
      })
    }
    _save()
  }

  function updateItem(uid, patch) {
    const item = items.value.find(i => i.uid === uid)
    if (!item) return
    Object.assign(item, patch, { error: null })
    _save()
  }

  function removeItem(uid) {
    items.value = items.value.filter(i => i.uid !== uid)
    _save()
  }

  function clear() {
    items.value = []
    _save()
  }

  /** Marks a specific item with an error message (after a failed batch booking) */
  function setError(uid, message) {
    const item = items.value.find(i => i.uid === uid)
    if (item) item.error = message
  }

  /** Converts cart items into the payload shape expected by POST /movements/batch */
  function toBatchPayload() {
    return items.value.map(i => ({
      article_id: i.article_id,
      type:       i.type,
      qty:        i.qty,
      meters:     i.meters,
      reference:  i.reference || undefined,
    }))
  }

  return {
    items, count, isEmpty,
    addItem, updateItem, removeItem, clear, setError,
    toBatchPayload,
  }
})
