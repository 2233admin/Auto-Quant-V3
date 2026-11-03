import { translate, uiTemplate, uiText, useLanguage } from '../i18n'
import { useRef, type ReactNode } from 'react'
import type { FactorSummary, LibraryPoint, ProjectSummary, StrategySummary } from '../api'
import { when } from '../format'
import { testVisible } from '../pages/testGate'
import { useSlidingHighlight } from '../components/motion/useSlidingHighlight'
import { SignedValue } from '../components/workbench/SignedValue'
import { MetricInfo, type MetricId } from '../components/MetricInfo'
import { Icon } from '../design/icons'
import { PageMark } from '../design/marks'
import './cards.css'
const labels: Record<string, string> = { All: '全部', Supported: '支持', Inconclusive: '结论不明确', 'Not tested': '未测试', 'Could not be tested': '无法测试', Backtested: '已回测', Tuned: '已调优', Defined: '已定义', Development: '开发' }

export const FACTOR_FILTERS = ['All', 'Supported', 'Inconclusive', 'Not tested', 'Could not be tested'] as const
export function filterCounts<T>(rows: T[], filters: readonly string[], state: (r: T) => string) {
  return Object.fromEntries(filters.map(f => [f, f === 'All' ? rows.length : rows.filter(r => state(r) === f).length]))
}

/**
 * The library object type of a Project. A Project that publishes a Portfolio (strategy) projection is a strategy or a
 * multi-lane desk even when it also carries the Factor Study it inherited; only a Project with a Factor projection and
 * no strategy projection is a Factor object.
 */
export type LibraryKind = 'factor' | 'strategy'
export function libraryKind(p: Pick<ProjectSummary, 'library'>): LibraryKind | null {
  if (p.library?.strategy) return 'strategy'
  if (p.library?.factor) return 'factor'
  return null
}
export const isFactorProject = (p: Pick<ProjectSummary, 'library'>) => libraryKind(p) === 'factor'

const value = (v: number | null | undefined, digits: number, signed = false) => v == null ? '—' : `${signed && v >= 0 ? '+' : ''}${v.toFixed(digits)}`
export const factorMetricLine = (s: FactorSummary) => s.validation
  ? uiTemplate("Validation rank IC {0} · HAC t {1} · Trials {2}", [value(s.validation.meanRankIc, 3, true), value(s.validation.hacTStatistic, 1), s.trials])
  : uiTemplate("{0} · Trials {1}", [uiText(s.verdict), s.trials])
export const strategyMetricLine = (s: StrategySummary) => s.net
  ? uiTemplate("Net total return {0} · Net Sharpe {1} · Max drawdown {2}", [s.net.totalReturn == null ? '—' : value(s.net.totalReturn * 100, 2, true) + '%', value(s.net.sharpe, 2), s.net.maximumDrawdown == null ? '—' : value(s.net.maximumDrawdown * 100, 2) + '%'])
  : uiText("No Portfolio Run metrics yet")
export const factorPoints = (s: FactorSummary) => s.points.filter(p => p.split !== 'test' || testVisible(s.protocol, { testAudit: s.testAudit }))

export function LibraryTitle({ strategy = false, count }: { strategy?: boolean; count?: number }) {
  const language = useLanguage()
  const micro = `${strategy ? 'STRATEGY LIBRARY' : 'FACTOR LIBRARY'}${count === undefined ? '' : ` / ${String(count).padStart(2, '0')}`}`
  return <header className="library-title sec-bar" data-measure="title"><Icon name={strategy ? 'strategies' : 'factors'} /><h1>{strategy ? translate(language, 'Strategies', '策略') : translate(language, 'Factors', '因子')}</h1><p>{strategy ? translate(language, 'Build portfolios from factors and inspect net-of-cost backtests.', '基于因子构建组合，查看扣除成本后的回测。') : translate(language, 'Test factor ideas on staged data; every trial is counted.', '使用准备好的数据检验因子想法；每次试验都会计数。')}</p><PageMark kind="barcode" micro={micro} /></header>
}

/** Verdict or state filter: text tabs with counts, the active one underlined. Reset appears only while a filter is set. */
export function LibraryFilter({ options, counts, selected, onSelect, onReset, label = 'Verdict' }: { options: readonly string[]; counts: Record<string, number>; selected: string; onSelect: (value: string) => void; onReset?: () => void; label?: string }) {
  const language = useLanguage()
  const ref = useRef<HTMLDivElement>(null)
  useSlidingHighlight(ref, { items: 'button', active: '[aria-pressed="true"]' })
  return <div className="library-facets"><div ref={ref} className="library-filter mo-hl mo-hl--tabs" data-measure="filter" role="group" aria-label={uiTemplate("{0} filter", [uiText(label)])}>{options.map(f => <button key={f} aria-pressed={selected === f} onClick={() => onSelect(f)}>{language === 'zh' ? labels[f] ?? uiText(f) : f}<span>{counts[f]}</span></button>)}</div>{onReset && <button className="library-reset" onClick={onReset}>{uiText("Reset filters")}</button>}</div>
}

export function MiniCurve({ points, label }: { points: LibraryPoint[]; label: string }) {
  const language = useLanguage()
  const values = points.map(p => p.value).filter(Number.isFinite)
  if (values.length < 2) return <span className="library-spark library-no-curve" data-measure="sparkline">{translate(language, 'No curve', '无曲线')}</span>
  const low = Math.min(...values), high = Math.max(...values)
  const path = values.map((v, i) => `${i * 104 / (values.length - 1)},${21 - (v - low) / (high - low || 1) * 19}`).join(' ')
  return <svg className="library-spark" data-measure="sparkline" viewBox="0 0 106 22" role="img" aria-label={label}><polyline className="fx-draw" pathLength={1} points={path} fill="none" stroke="currentColor" strokeWidth="1.25" /></svg>
}

/** `r` right-aligns a metric column, which then carries its catalogue definition; `end` right-aligns a non-metric column. */
export type LibraryColumn = { label: string; className?: 'r' | 'end'; metric?: MetricId }

/** One aligned list per library: a label-type header row, then one row per object. Columns come from the page. */
export function LibraryTable({ kind, columns, children, footer }: { kind: LibraryKind; columns: LibraryColumn[]; children: ReactNode; footer: ReactNode }) {
  return <div className={`library-list library-list--${kind}`} data-measure="grid">
    <table className="library-table">
      <thead><tr>{columns.map(c => <th key={c.label} scope="col" className={c.className}>{uiText(c.label)}{c.metric && <MetricInfo id={c.metric} label={uiText(c.label)} align="end" />}</th>)}</tr></thead>
      <tbody>{children}</tbody>
    </table>
    <p className="library-end" role="status">{footer}</p>
  </div>
}

/**
 * One library object as one row: name with its split/state line, verdict or state, the focal metric (the only number
 * that may carry sign colour), the neutral numbers, an optional overlap line, the curve and the update time.
 */
export function LibraryRow({ name, badge, metric, headline, secondary, numbers, points, updated, href, strategy, description, overlap, go }: { name: string; badge: string; metric: string; secondary?: string; headline?: { value: number | null | undefined; label: string; digits: number; unit?: string }; numbers: ReactNode[]; points: LibraryPoint[]; updated: string | null; href: string; strategy?: boolean; description?: string | null; overlap?: ReactNode; go: (href: string) => void }) {
  const language = useLanguage()
  return <tr className="library-row" data-measure="card" aria-label={name} onClick={e => { if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !(e.target as Element).closest('a,button,.info')) go(href) }}>
    <th scope="row" className="library-name">
      <a href={href} title={name} translate="no">{name}</a>
      <span className="library-sub">{headline ? <><span className="development-tag">{uiText("development")}</span> · {uiText("validation")}</> : secondary ?? uiText("No validation data")}</span>
      {strategy && description && <span className="library-description" title={description}>{description}</span>}
    </th>
    <td className="library-verdict" data-state={badge}>{language === 'zh' ? labels[badge] ?? badge : badge}</td>
    <td className="library-focal" data-sign-area="library-headline" title={metric}>{headline ? <SignedValue {...headline} focal /> : <span className="library-none">—</span>}</td>
    {numbers.map((n, i) => <td key={i} className="library-num">{n}</td>)}
    {!strategy && <td className="library-overlap">{overlap}</td>}
    <td className="library-curve"><MiniCurve points={points} label={strategy ? uiText("Net growth, train and validation only") : uiText("Latest Run long-short cumulative curve, permitted splits only")} /></td>
    <td className="library-updated" title={updated ?? uiText("No Run yet")}>{updated ? <span className="mono">{when(updated)}</span> : translate(language, 'Not run', '未运行')}</td>
  </tr>
}
