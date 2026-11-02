import type { FactorCumulativePoint } from '../../api'
import { uiText } from '../../i18n'

type Point = { date: number; value: number }
function values(points: FactorCumulativePoint[], group: string): Point[] {
  return points.flatMap(p => {
    const value = p[group as 'spread']
    const date = Date.parse(p.timestamp)
    return typeof value === 'number' && Number.isFinite(value) && Number.isFinite(date) ? [{ date, value }] : []
  })
}
export function PairedCurve({ a, b, group, width, height }: { a: FactorCumulativePoint[]; b: FactorCumulativePoint[]; group: string; width: number; height: number }) {
  const series = [values(a, group), values(b, group)]
  const points = series.flat()
  if (!points.length) return <p>{uiText('No published cumulative curve for this group.')}</p>
  const lo = Math.min(0, ...points.map(p => p.value)), hi = Math.max(...points.map(p => p.value), lo + 0.001)
  const start = Math.min(...points.map(p => p.date)), end = Math.max(...points.map(p => p.date), start + 1)
  const x = (d: number) => 55 + (d - start) / (end - start) * (width - 100)
  const y = (v: number) => 20 + (hi - v) / (hi - lo) * (height - 55)
  return <svg width={width} height={height} role="img" aria-label={uiText('Baseline and subject cumulative group growth')}>
    {[lo, (lo + hi) / 2, hi].map(t => <g key={t}><line x1={55} x2={width - 45} y1={y(t)} y2={y(t)} stroke="var(--grid)" /><text x={48} y={y(t) + 4} textAnchor="end" fill="var(--muted)" fontSize="11">{t.toFixed(2)}</text></g>)}
    {series.map((s, i) => <g key={i}><path d={s.map((p, n) => `${n ? 'L' : 'M'}${x(p.date)},${y(p.value)}`).join(' ')} fill="none" stroke={i ? 'var(--signal-graphic)' : 'var(--stroke)'} strokeWidth="2" />
      {s.length > 0 && <text x={width - 40} y={y(s[s.length - 1].value) + (i ? -4 : 12)} fill="var(--text)" fontSize="11">{s[s.length - 1].value.toFixed(2)}</text>}</g>)}
    <text x={55} y={height - 8} fill="var(--muted)" fontSize="11">{new Date(start).toISOString().slice(0, 10)}</text>
    <text x={width - 45} y={height - 8} textAnchor="end" fill="var(--muted)" fontSize="11">{new Date(end).toISOString().slice(0, 10)}</text>
  </svg>
}
