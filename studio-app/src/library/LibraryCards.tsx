import { useRef } from 'react'
import type { FactorSummary, LibraryPoint, StrategySummary } from '../api'
import { Icon } from '../design/icons'
import { when } from '../format'
import { testVisible } from '../pages/testGate'
import { useSlidingHighlight } from '../components/motion/useSlidingHighlight'
import './cards.css'

export const FACTOR_FILTERS = ['All', 'Supported', 'Inconclusive', 'Not tested', 'Could not be tested'] as const
export function filterCounts<T>(rows: T[], filters: readonly string[], state: (r: T) => string) {
  return Object.fromEntries(filters.map(f => [f, f === 'All' ? rows.length : rows.filter(r => state(r) === f).length]))
}
const value = (v: number | null | undefined, digits: number, signed = false) => v == null ? '—' : `${signed && v >= 0 ? '+' : ''}${v.toFixed(digits)}`
export const factorMetricLine = (s: FactorSummary) => s.validation
  ? `Validation rank IC ${value(s.validation.meanRankIc, 3, true)} · HAC t ${value(s.validation.hacTStatistic, 1)} · Trials ${s.trials}`
  : `${s.verdict} · Trials ${s.trials}`
export const strategyMetricLine = (s: StrategySummary) => s.net
  ? `Net total return ${s.net.totalReturn == null ? '—' : value(s.net.totalReturn * 100, 2, true) + '%'} · Net Sharpe ${value(s.net.sharpe, 2)} · Max drawdown ${s.net.maximumDrawdown == null ? '—' : value(s.net.maximumDrawdown * 100, 2) + '%'}`
  : 'No Portfolio Run metrics yet'
export const factorPoints = (s: FactorSummary) => s.points.filter(p => p.split !== 'test' || testVisible(s.protocol, { testAudit: s.testAudit }))

export function LibraryTitle({ strategy = false }: { strategy?: boolean }) {
  return <header className="library-title" data-measure="title"><Icon name={strategy ? 'strategies' : 'factors'} /><h1>{strategy ? 'Strategies' : 'Factors'}</h1><p>{strategy ? 'Build portfolios from factors and inspect net-of-cost backtests.' : 'Test factor ideas on staged data; every trial is counted.'}</p></header>
}
export function LibraryFilter({ options, counts, selected, onSelect }: { options: readonly string[]; counts: Record<string, number>; selected: string; onSelect: (value: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useSlidingHighlight(ref, { items: 'button', active: '[aria-pressed="true"]' })
  return <div ref={ref} className="library-filter mo-hl" data-measure="filter" role="group" aria-label="Library filter">{options.map(f => <button key={f} aria-pressed={selected === f} onClick={() => onSelect(f)}>{f}<span>{counts[f]}</span></button>)}</div>
}
export function MiniCurve({ points, label }: { points: LibraryPoint[]; label: string }) {
  const values = points.map(p => p.value).filter(Number.isFinite)
  if (values.length < 2) return <span className="library-spark library-no-curve" data-measure="sparkline">No curve</span>
  const low = Math.min(...values), high = Math.max(...values)
  const path = values.map((v, i) => `${i * 144 / (values.length - 1)},${25 - (v - low) / (high - low || 1) * 23}`).join(' ')
  return <svg className="library-spark" data-measure="sparkline" viewBox="0 0 147 27" role="img" aria-label={label}><polygon points={`0,27 ${path} 144,27`} fill="currentColor" opacity="0.08" /><polyline points={path} fill="none" stroke="currentColor" strokeWidth="1.25" /></svg>
}
export function LibraryCard({ name, badge, metric, points, updated, href, strategy, description, go }: { name: string; badge: string; metric: string; points: LibraryPoint[]; updated: string | null; href: string; strategy?: boolean; description?: string | null; go: (href: string) => void }) {
  const tone = badge === 'Supported' ? 'ok' : badge === 'Could not be tested' ? 'bad' : 'warn'
  return <article className={`library-card ${strategy ? 'library-card--strategy' : ''}`} data-measure="card" aria-label={name} onClick={e => { if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !(e.target as Element).closest('a,button')) go(href) }}>
    <div className="library-card-top"><a href={href} title={name}>{name}</a><span className="library-badge">{badge}</span></div>
    {strategy && <p className="library-description" title={description ?? undefined}>{description || 'Portfolio construction defined by its Study.'}</p>}
    <div className={`library-card-evidence tone-${tone}`}><p className="library-metric" title={metric}>{metric}</p><MiniCurve points={points} label={strategy ? 'Net growth, train and validation only' : 'Latest Run long-short cumulative curve, permitted splits only'} /></div>
    <footer className="library-card-footer" data-measure="footer"><span><Icon name={strategy ? 'strategies' : 'factors'} />{strategy ? 'Strategy' : 'Factor expression'}</span><span title={updated ?? 'No Run yet'}>Last updated: {updated ? when(updated) : 'Not run'}</span></footer>
  </article>
}
