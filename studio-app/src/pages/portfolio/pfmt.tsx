import { uiText, uiValue } from '../../i18n'
import type { ReactNode } from 'react'

export const finite = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v)
const MINUS = '−'

/** Signed fixed-decimal number with a real minus sign; null and non-finite show as a dash, never as zero. */
export function sn(v: number | null | undefined, d = 2): string {
  if (!finite(v)) return '—'
  const s = Math.abs(v).toFixed(d)
  if (Number(s) === 0) return s
  return v < 0 ? `${MINUS}${s}` : `+${s}`
}

/** Fraction as a signed percentage. */
export function sp(v: number | null | undefined, d = 2): string {
  if (!finite(v)) return '—'
  return `${sn(v * 100, d)}%`
}

/** Fraction as an unsigned percentage. */
export function up(v: number | null | undefined, d = 1): string {
  return finite(v) ? `${(v * 100).toFixed(d)}%` : '—'
}

/** Unsigned number with grouping off; negatives with a real minus. */
export function fn(v: number | null | undefined, d = 2): string {
  if (!finite(v)) return '—'
  const s = Math.abs(v).toFixed(d)
  return v < 0 && Number(s) !== 0 ? `${MINUS}${s}` : s
}

export const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '—')

/** An honest gap: says what is missing and why, in the same words everywhere. */
export function NA({ why }: { why: string }) {
  return <span className="pf-na">{uiText("not available: ")}{why}</span>
}

export function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="pf-block">
      <h3 className="h-small">{title}</h3>
      {children}
    </div>
  )
}

export function Kv({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="kv">
      {rows.map(([k, v]) => (
        <div className="kv-row" key={k}>
          <dt>{uiText(k)}</dt>
          <dd>{typeof v === 'string' ? uiValue(v) : v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function SplitToggle({
  value,
  onChange,
  testVisible,
}: {
  value: 'validation' | 'test'
  onChange: (v: 'validation' | 'test') => void
  testVisible: boolean
}) {
  return (
    <span className="pf-split">
      <span className="seg" role="group" aria-label={uiText("Split")}>
        <button type="button" aria-pressed={value === 'validation'} onClick={() => onChange('validation')}>{uiText("Validation · selection")}</button>
        {testVisible ? (
          <button type="button" aria-pressed={value === 'test'} onClick={() => onChange('test')}>{uiText("Test · visible audit")}</button>
        ) : (
          <button type="button" disabled title={uiText("not available: no test audit is published for this Run, so no test number is drawn")}>{uiText("Test · hidden")}</button>
        )}
      </span>
    </span>
  )
}
