import { translate, uiTemplate, uiText, useLanguage } from '../i18n'
import { useRef, type ReactNode } from 'react'
import type { FactorSummary, LibraryPoint, StrategySummary } from '../api'
import { Icon } from '../design/icons'
import { when } from '../format'
import { testVisible } from '../pages/testGate'
import { useSlidingHighlight } from '../components/motion/useSlidingHighlight'
import { SignedValue } from '../components/workbench/SignedValue'
import { MetricListInfo, type MetricId } from '../components/MetricInfo'
import './cards.css'
const labels: Record<string, string> = { All: '全部', Supported: '支持', Inconclusive: '结论不明确', 'Not tested': '未测试', 'Could not be tested': '无法测试', Backtested: '已回测', Tuned: '已调优', Defined: '已定义', Development: '开发' }

export const FACTOR_FILTERS = ['All', 'Supported', 'Inconclusive', 'Not tested', 'Could not be tested'] as const
export function filterCounts<T>(rows: T[], filters: readonly string[], state: (r: T) => string) {
  return Object.fromEntries(filters.map(f => [f, f === 'All' ? rows.length : rows.filter(r => state(r) === f).length]))
}
const value = (v: number | null | undefined, digits: number, signed = false) => v == null ? '—' : `${signed && v >= 0 ? '+' : ''}${v.toFixed(digits)}`
export const factorMetricLine = (s: FactorSummary) => s.validation
  ? uiTemplate("Validation rank IC {0} · HAC t {1} · Trials {2}", [value(s.validation.meanRankIc, 3, true), value(s.validation.hacTStatistic, 1), s.trials])
  : uiTemplate("{0} · Trials {1}", [uiText(s.verdict), s.trials])
export const strategyMetricLine = (s: StrategySummary) => s.net
  ? uiTemplate("Net total return {0} · Net Sharpe {1} · Max drawdown {2}", [s.net.totalReturn == null ? '—' : value(s.net.totalReturn * 100, 2, true) + '%', value(s.net.sharpe, 2), s.net.maximumDrawdown == null ? '—' : value(s.net.maximumDrawdown * 100, 2) + '%'])
  : uiText("No Portfolio Run metrics yet")
export const factorPoints = (s: FactorSummary) => s.points.filter(p => p.split !== 'test' || testVisible(s.protocol, { testAudit: s.testAudit }))

export function LibraryTitle({ strategy = false }: { strategy?: boolean }) {
  const language = useLanguage()
  return <header className="library-title" data-measure="title"><Icon name={strategy ? 'strategies' : 'factors'} /><h1>{strategy ? translate(language, 'Strategies', '策略') : translate(language, 'Factors', '因子')}</h1><p>{strategy ? translate(language, 'Build portfolios from factors and inspect net-of-cost backtests.', '基于因子构建组合，查看扣除成本后的回测。') : translate(language, 'Test factor ideas on staged data; every trial is counted.', '使用准备好的数据检验因子想法；每次试验都会计数。')}</p></header>
}
export function LibraryFilter({ options, counts, selected, onSelect, onReset, label = 'Verdict' }: { options: readonly string[]; counts: Record<string, number>; selected: string; onSelect: (value: string) => void; onReset?: () => void; label?: string }) {
  const language = useLanguage()
  const ref = useRef<HTMLDivElement>(null)
  useSlidingHighlight(ref, { items: 'button', active: '[aria-pressed="true"]' })
  return <div className="library-facets"><span className="library-facet-label">{uiText(label)}</span><div ref={ref} className="library-filter mo-hl" data-measure="filter" role="group" aria-label={uiTemplate("{0} filter", [uiText(label)])}>{options.map(f => <button key={f} aria-pressed={selected === f} onClick={() => onSelect(f)}>{language === 'zh' ? labels[f] ?? uiText(f) : f}<span>{counts[f]}</span></button>)}</div>{onReset && <button className="library-reset" onClick={onReset}>{uiText("Reset filters")}</button>}</div>
}
export function MiniCurve({ points, label }: { points: LibraryPoint[]; label: string }) {
  const language = useLanguage()
  const values = points.map(p => p.value).filter(Number.isFinite)
  if (values.length < 2) return <span className="library-spark library-no-curve" data-measure="sparkline">{translate(language, 'No curve', '暂无曲线')}</span>
  const low = Math.min(...values), high = Math.max(...values)
  const path = values.map((v, i) => `${i * 144 / (values.length - 1)},${25 - (v - low) / (high - low || 1) * 23}`).join(' ')
  return <svg className="library-spark" data-measure="sparkline" viewBox="0 0 147 27" role="img" aria-label={label}><polygon points={`0,27 ${path} 144,27`} fill="currentColor" opacity="0.08" /><polyline points={path} fill="none" stroke="currentColor" strokeWidth="1.25" /></svg>
}
export function LibraryCard({ name, badge, metric, metrics, headline, secondary, points, updated, href, strategy, description, overlap, go }: { name: string; badge: string; metric: string; metrics?: MetricId[]; secondary?: string; headline?: { value: number | null | undefined; label: string; digits: number; unit?: string }; points: LibraryPoint[]; updated: string | null; href: string; strategy?: boolean; description?: string | null; overlap?: ReactNode; go: (href: string) => void }) {
  const language = useLanguage()
  return <article className={`library-card ${strategy ? 'library-card--strategy' : ''}`} data-measure="card" aria-label={name} onClick={e => { if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !(e.target as Element).closest('a,button,.info')) go(href) }}>
    <div className="library-card-top"><a href={href} title={name}>{name}</a><span className="library-badge" data-state={badge}>{language === 'zh' ? labels[badge] ?? badge : badge}</span></div>
    {strategy && <p className="library-description" title={description ?? undefined}>{description || uiText("Portfolio construction defined by its Study.")}</p>}
    <div className="library-card-evidence"><div style={{ minWidth: 0, flex: 1 }}><p className="library-metric" data-sign-area="library-headline" title={metric}>{headline ? <><SignedValue {...headline} focal /><small>{uiText(headline.label)}</small></> : metric}</p>{headline && <div className="library-secondary">{secondary && <>{secondary} · </>}<span className="development-tag">{uiText("development")}</span> · {uiText("validation")}</div>}</div>{metrics && metrics.length > 0 && <MetricListInfo ids={metrics} label={uiText("What these numbers mean")} />}<MiniCurve points={points} label={strategy ? uiText("Net growth, train and validation only") : uiText("Latest Run long-short cumulative curve, permitted splits only")} /></div>
    {overlap}
    <footer className="library-card-footer" data-measure="footer"><span><Icon name={strategy ? 'strategies' : 'factors'} />{strategy ? translate(language, 'Strategy', '策略') : translate(language, 'Factor expression', '因子表达式')}</span><span title={updated ?? uiText("No Run yet")}>{translate(language, 'Last updated:', '最近更新：')} {updated ? when(updated) : translate(language, 'Not run', '未运行')}</span></footer>
  </article>
}
