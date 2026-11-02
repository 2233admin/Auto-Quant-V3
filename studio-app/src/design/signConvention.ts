export type SignConvention = 'red-up' | 'green-up'
export const SIGN_CONVENTION_KEY = 'aq-studio-sign-convention'

export function storedSignConvention(): SignConvention {
  try { return localStorage.getItem(SIGN_CONVENTION_KEY) === 'green-up' ? 'green-up' : 'red-up' }
  catch { return 'red-up' }
}

/** Viewer presentation only. Storage denial must never prevent a local choice. */
export function applySignConvention(value: SignConvention): void {
  if (typeof document !== 'undefined') document.documentElement.dataset.signConvention = value
  try { localStorage.setItem(SIGN_CONVENTION_KEY, value) } catch { /* In-memory choice remains active. */ }
}

export function signRole(value: number | null | undefined): 'positive' | 'negative' | 'neutral' {
  return typeof value !== 'number' || !Number.isFinite(value) || value === 0 ? 'neutral' : value > 0 ? 'positive' : 'negative'
}

/** Round for display, retaining direction independently of colour. Rounded zero is unsigned. */
export function signedNumber(value: number | null | undefined, digits = 2, unit = ''): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  const magnitude = Math.abs(value).toFixed(digits)
  return `${Number(magnitude) === 0 ? '' : value > 0 ? '+' : '−'}${magnitude}${unit}`
}

export function formattedSignRole(value: string): ReturnType<typeof signRole> {
  return /^\+\d/.test(value) ? 'positive' : /^[−-]\d/.test(value) ? 'negative' : 'neutral'
}
