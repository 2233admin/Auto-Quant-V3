import { getLanguage, uiText } from './i18n'
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
  const units: Record<string, string> = { Study: '个研究', Run: '次运行', Session: '个会话', Report: '份报告', Project: '个项目', asset: '个资产', trial: '次试验', cell: '个单元格', cut: '个切点', line: '行', error: '个错误', idea: '个想法', 'valued Run': '次带数值运行', 'immutable Run': '次不可变运行', 'primary non-overlapping event': '个主要不重叠事件', 'chronological validation fold': '个时间验证分折', 'predeclared configuration': '个预声明配置' }
  if (getLanguage() === 'zh' && units[one]) return `${n} ${units[one]}`
  const word = uiText(one)
  if (word !== one) return `${n} ${word}`
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
