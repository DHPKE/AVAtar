// ─── Article types ────────────────────────────────────────────────────────────
export const TYPE_META = {
  consumable: { label: 'Verbrauch', color: '#A855F7', bg: 'rgba(168,85,247,.15)'  },
  bundle:     { label: 'Gebinde',   color: '#F97316', bg: 'rgba(249,115,22,.15)'  },
  equipment:  { label: 'Gerät',     color: '#008FD0', bg: 'rgba(0,143,208,.15)'   },
  rental:     { label: 'Verleih',   color: '#14B8A6', bg: 'rgba(20,184,166,.15)'  },
  cable:      { label: 'Kabel',     color: '#EAB308', bg: 'rgba(234,179,8,.15)'   },
}

export const MOVEMENT_META = {
  in:         { label: 'Eingang',   color: '#22C55E', bg: 'rgba(34,197,94,.15)'  },
  out:        { label: 'Ausgang',   color: '#EF4444', bg: 'rgba(239,68,68,.15)'  },
  rental_out: { label: 'Verliehen', color: '#14B8A6', bg: 'rgba(20,184,166,.15)' },
  rental_in:  { label: 'Rückgabe',  color: '#008FD0', bg: 'rgba(0,143,208,.15)'  },
  correction: { label: 'Korrektur', color: '#F59E0B', bg: 'rgba(245,158,11,.15)' },
}

export const VALID_TYPES  = ['consumable', 'bundle', 'equipment', 'rental', 'cable']
export const VALID_UNITS  = { consumable: 'piece', bundle: 'bundle', equipment: 'piece', rental: 'piece', cable: 'meter' }

// ─── Formatters ───────────────────────────────────────────────────────────────
export function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function fmtStock(article) {
  if (!article) return '—'
  return article.unit === 'meter'
    ? `${article.stock_meters} m`
    : `${article.stock_qty} Stk`
}

export function isLowStock(article) {
  if (!article || article.min_stock <= 0) return false
  return article.unit === 'meter'
    ? article.stock_meters <= article.min_stock
    : article.stock_qty    <= article.min_stock
}

// ─── Days helper for chart ────────────────────────────────────────────────────
export function lastNDays(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (n - 1 - i))
    return d.toISOString().slice(0, 10)
  })
}
