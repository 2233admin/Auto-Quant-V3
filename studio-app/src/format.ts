/** UTC `YYYY-MM-DD HH:MM` from an ISO timestamp; unreadable input is shown as written. */
export function when(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toISOString().slice(0, 16).replace('T', ' ')
}

/** A number with a fixed number of decimals; null and non-finite values show as a dash, never as zero. */
export function num(value: number | null | undefined, digits = 3): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—'
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

/** A fraction as a percentage with one decimal; null shows as a dash, never as 0%. */
export function pct(value: number | null | undefined, digits = 1): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : '—'
}

/** A return as a signed percentage with two decimals. */
export function ret(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%` : '—'
}
