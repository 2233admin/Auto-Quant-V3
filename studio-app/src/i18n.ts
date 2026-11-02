import { useSyncExternalStore } from 'react'
import catalog from './locales/zh-CN.json'

type Language = 'en' | 'zh'
// Owner decision 2026-11-03: Chinese is the default in the browser; English stays the server-render and test default.
let language: Language = (() => { if (typeof window === 'undefined') return 'en'; try { return localStorage.getItem('aq-language') === 'en' ? 'en' : 'zh' } catch { return 'zh' } })()
if (typeof document !== 'undefined') document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'
const listeners = new Set<() => void>()
export function getLanguage(): Language { return language }
const templates = Object.entries(catalog).filter(([key]) => key.includes('{0}') && key.replace(/\{\d+\}/g, '').replace(/[^A-Za-z]/g, '').length >= 6).map(([key, copy]) => {
  const indices: number[] = []
  const escaped = key.split(/(\{\d+\})/g).map((part) => {
    if (/^\{\d+\}$/.test(part)) { indices.push(Number(part.slice(1, -1))); return '(.+?)' }
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }).join('')
  return { pattern: new RegExp('^' + escaped + '$'), indices, copy }
})
export function setLanguage(next: Language) {
  language = next
  try { if (typeof window !== 'undefined') localStorage.setItem('aq-language', next) } catch { /* Storage is optional. */ }
  if (typeof document !== 'undefined') document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en'
  listeners.forEach((listener) => listener())
}
export function useLanguage() {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener) }, () => language, () => language)
}
export function translate(language: Language, english: string, chinese: string) { return language === 'zh' ? chinese : english }

/** Only source-authored UI copy is passed here. User content and evidence stay untouched. */
export function uiText(value: string): string {
  value = decodeUiText(value)
  if (language !== 'zh') return value
  const key = value.replace(/\s+/g, ' ').trim()
  const translated = (catalog as Record<string, string>)[key]
  if (!translated) {
    for (const item of templates) {
      const found = item.pattern.exec(key)
      if (!found) continue
      const values: string[] = []
      item.indices.forEach((index, n) => { values[index] = found[n + 1] })
      return item.copy.replace(/\{(\d+)\}/g, (_, index: string) => values[Number(index)] ?? '')
    }
    return value
  }
  const leading = value.match(/^\s*/)?.[0] ?? ''
  const trailing = value.match(/\s*$/)?.[0] ?? ''
  return leading + translated + trailing
}

export function uiTemplate(key: string, values: unknown[]): string {
  key = decodeUiText(key)
  const copy = language === 'zh' ? (catalog as Record<string, string>)[key] ?? key : key
  return copy.replace(/\{(\d+)\}/g, (_, index: string) => String(values[Number(index)]))
}

export function uiValue<T>(value: T): T {
  return (typeof value === 'string' ? uiText(value) : value) as T
}

function decodeUiText(value: string): string {
  const entities: Record<string, string> = { amp: '&', apos: "'", quot: '"', lt: '<', gt: '>', nbsp: '\u00a0', ndash: '–', mdash: '—', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', times: '×', le: '≤', ge: '≥', plusmn: '±' }
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (original, code: string) => {
    if (code[0] !== '#') return entities[code] ?? original
    const number = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
    return number >= 0 && number <= 0x10ffff ? String.fromCodePoint(number) : original
  })
}
