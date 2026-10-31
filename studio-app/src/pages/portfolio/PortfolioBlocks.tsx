import { useMemo, useState } from 'react'
import { Glyph } from '../../design/icons'
import type {
  AttributionRow,
  BookPosition,
  Episode,
  NeighborConfig,
  NeighborSplit,
  PerfSummary,
  PortfolioDiagnostics,
  Transition,
  ViabilitySplit,
} from './portfolioTypes'
import { Block, finite, fn, Kv, NA, sn, sp, up, day } from './pfmt'

type Split = 'validation' | 'test'

/* ------------------------------------------------------------------ viability and cost stress */

const PERF_ROWS: { key: keyof PerfSummary; label: string; f: (v: number | null | undefined) => string }[] = [
  { key: 'totalReturn', label: 'Total return', f: (v) => sp(v) },
  { key: 'annualReturn', label: 'Annualized return', f: (v) => sp(v) },
  { key: 'annualVolatility', label: 'Annualized volatility', f: (v) => up(v, 2) },
  { key: 'sharpe', label: 'Sharpe', f: (v) => fn(v) },
  { key: 'sortino', label: 'Sortino', f: (v) => fn(v) },
  { key: 'maximumDrawdown', label: 'Max drawdown', f: (v) => sp(v) },
  { key: 'expectedShortfall95', label: 'Expected shortfall 95%', f: (v) => up(v, 2) },
  { key: 'positiveRate', label: 'Positive-day rate', f: (v) => up(v) },
  { key: 'informationRatio', label: 'Information ratio', f: (v) => fn(v) },
]

const BREAK_EVEN_WHY: Record<string, string> = {
  'gross-non-positive': 'gross return is not positive, so no cost level is a break-even',
}

export function ViabilityBlock({ pf, split }: { pf: PortfolioDiagnostics; split: Split }) {
  const v: ViabilitySplit | undefined = pf.strategyViability?.[split]
  const diag = pf.strategyViability?.diagnosis
  const sig = pf.signalMonetization?.diagnosis
  if (!v) return <NA why={`strategyViability.${split} is not in the payload`} />
  const f = v.friction
  const be = f?.breakEvenCost
  const t = v.temporal
  return (
    <div className="vstack">
      <div className="pf-diag box">
        <p className="h-small">Server diagnosis · validation split only (testEntersDiagnosis: {String(diag?.testEntersDiagnosis ?? '—')})</p>
        {diag ? (
          <p>
            <strong className="mono">{diag.stage}</strong>, next focus <span className="mono">{diag.iterationFocus}</span>. {diag.explanation}
          </p>
        ) : (
          <p><NA why="strategyViability.diagnosis is not in the payload" /></p>
        )}
        {sig && (
          <p>
            Signal intent, before sizing and cost: <strong className="mono">{sig.outcome}</strong>
            {sig.largestAdverseStage && <>; largest adverse stage <span className="mono">{sig.largestAdverseStage}</span> ({sp(sig.largestAdverseAnnualizedDelta)} annualized)</>}. {sig.explanation}
          </p>
        )}
      </div>

      <div className="cols cols--tables">
        <div className="tablewrap pf-narrow">
          <table className="tbl">
            <caption className="small muted">Gross vs net vs benchmark, {split} split ({v.net?.observations ?? '—'} daily observations)</caption>
            <thead>
              <tr>
                <th scope="col">Metric</th>
                <th scope="col" className="r">Gross (no cost)</th>
                <th scope="col" className="r">Net (after cost)</th>
                <th scope="col" className="r">Benchmark</th>
              </tr>
            </thead>
            <tbody>
              {PERF_ROWS.map((r) => (
                <tr key={r.key}>
                  <th scope="row">{r.label}</th>
                  <td className="r">{r.f(v.gross?.[r.key])}</td>
                  <td className="r">{r.f(v.net?.[r.key])}</td>
                  <td className="r">{r.key === 'informationRatio' ? <span className="faint">0 by definition</span> : r.f(v.benchmark?.[r.key])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="tablewrap pf-narrow">
          <table className="tbl">
            <caption className="small muted">Cost stress and one extra bar of delay (net, {split} split)</caption>
            <thead>
              <tr>
                <th scope="col">Scenario</th>
                <th scope="col" className="r">Total return</th>
                <th scope="col" className="r">Annualized</th>
                <th scope="col" className="r">Net Sharpe</th>
              </tr>
            </thead>
            <tbody>
              {(v.costStress ?? []).map((c) => (
                <tr key={c.costBps}>
                  <th scope="row">
                    {c.costBps} bps per one-way trade
                    {c.costBps === f?.baseCostBps && <span className="faint small">base cost</span>}
                    {c.costBps === 0 && <span className="faint small">frictionless</span>}
                  </th>
                  <td className="r">{sp(c.totalReturn)}</td>
                  <td className="r">{sp(c.annualReturn)}</td>
                  <td className="r">{fn(c.netSharpe)}</td>
                </tr>
              ))}
              {!v.costStress?.length && (
                <tr><td colSpan={4}><NA why="costStress is empty in the payload" /></td></tr>
              )}
              <tr>
                <th scope="row">
                  Extra delay
                  <span className="faint small">trade one bar later at base cost</span>
                </th>
                <td className="r">{sp(v.extraDelay?.totalReturn)}</td>
                <td className="r">{sp(v.extraDelay?.annualReturn)}</td>
                <td className="r">{fn(v.extraDelay?.netSharpe)}</td>
              </tr>
            </tbody>
          </table>
          {finite(v.extraDelay?.netSharpeDelta) && (
            <p className="small muted">Net Sharpe change from the extra delay, as published: {sn(v.extraDelay?.netSharpeDelta)}.</p>
          )}
        </div>
      </div>

      <div className="cols">
        <Block title="Friction">
          {f ? (
            <Kv
              rows={[
                ['Base cost', `${fn(f.baseCostBps, 1)} bps per one-way trade`],
                ['Total cost drag', up(f.totalCostDrag, 2)],
                ['Annualized one-way turnover', `${fn(f.annualizedOneWayTurnover, 1)}x`],
                ['Gross to net, total return', sp(f.grossToNetTotalReturnWedge)],
                ['Gross to net, annual return', sp(f.grossToNetAnnualReturnWedge)],
                ['Gross to net, Sharpe', sn(f.grossToNetSharpeDelta)],
                ['Gross return per turnover', finite(f.grossReturnPerOneWayTurnoverBps) ? `${sn(f.grossReturnPerOneWayTurnoverBps, 1)} bps` : <NA key="g" why="turnover is zero or not published" />],
                ['Net return per turnover', finite(f.netReturnPerOneWayTurnoverBps) ? `${sn(f.netReturnPerOneWayTurnoverBps, 1)} bps` : <NA key="n" why="turnover is zero or not published" />],
                [
                  'Break-even cost',
                  finite(be?.bps) ? (
                    <>
                      <span className="mono">{fn(be.bps, 1)} bps</span> one-way <span className="faint small">status {be.status}; search cap {be.searchMaximumBps} bps</span>
                    </>
                  ) : (
                    <NA why={`status "${be?.status ?? 'missing'}"${be?.status && BREAK_EVEN_WHY[be.status] ? `: ${BREAK_EVEN_WHY[be.status]}` : ''}`} />
                  ),
                ],
              ]}
            />
          ) : (
            <NA why={`strategyViability.${split}.friction is not in the payload`} />
          )}
        </Block>
        <Block title="Time structure of net returns">
          {t ? (
            <Kv
              rows={[
                ['Months in the split', String(t.months ?? '—')],
                ['Positive net months', up(t.positiveNetMonthRate, 0)],
                ['Best month', t.bestNetMonth ? `${t.bestNetMonth.month}: ${sp(t.bestNetMonth.return)}` : '—'],
                ['Worst month', t.worstNetMonth ? `${t.worstNetMonth.month}: ${sp(t.worstNetMonth.return)}` : '—'],
                ['Longest underwater', t.maximumUnderwaterBars !== undefined ? `${t.maximumUnderwaterBars} bars (${day(t.maximumUnderwaterStart)} to ${day(t.maximumUnderwaterEnd)})` : '—'],
                ['Underwater now', t.currentUnderwaterBars !== undefined ? `${t.currentUnderwaterBars} bars` : '—'],
                ['Share of |return| from best days', t.bestDayCount !== undefined ? `${up(t.bestDaysAbsoluteReturnShare)} from ${t.bestDayCount} best days` : '—'],
                ['Net total return without them', sp(t.netTotalReturnWithoutBestDays)],
              ]}
            />
          ) : (
            <NA why={`strategyViability.${split}.temporal is not in the payload`} />
          )}
        </Block>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ parameter neighborhood */

type SortKey = 'id' | 'netSharpe' | 'totalReturn' | 'annualizedOneWayTurnover' | 'totalCostDrag' | 'rebalanceRate' | 'signalTransitions' | 'netSharpeDeltaVsBase'
const COLS: { key: SortKey; label: string; f: (c: NeighborConfig) => string }[] = [
  { key: 'netSharpe', label: 'Net Sharpe', f: (c) => fn(c.netSharpe) },
  { key: 'netSharpeDeltaVsBase', label: 'vs base', f: (c) => sn(c.netSharpeDeltaVsBase) },
  { key: 'totalReturn', label: 'Total return', f: (c) => sp(c.totalReturn) },
  { key: 'annualizedOneWayTurnover', label: 'Turnover / yr', f: (c) => `${fn(c.annualizedOneWayTurnover, 1)}x` },
  { key: 'totalCostDrag', label: 'Cost drag', f: (c) => up(c.totalCostDrag, 2) },
  { key: 'rebalanceRate', label: 'Rebalance rate', f: (c) => up(c.rebalanceRate, 0) },
  { key: 'signalTransitions', label: 'Signal transitions', f: (c) => (finite(c.signalTransitions) ? String(c.signalTransitions) : '—') },
]

export function NeighborhoodBlock({ pf, split }: { pf: PortfolioDiagnostics; split: Split }) {
  const nb = pf.parameterNeighborhood
  const data: NeighborSplit | undefined = nb?.[split]
  const configs = useMemo(() => data?.configurations ?? [], [data])
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null)
  const rows = useMemo(() => {
    if (!sort) return configs
    const get = (c: NeighborConfig) => (sort.key === 'id' ? c.id : c[sort.key])
    return [...configs].sort((a, b) => {
      const x = get(a)
      const y = get(b)
      if (typeof x === 'string' && typeof y === 'string') return x.localeCompare(y) * sort.dir
      const xn = finite(x as number) ? (x as number) : -Infinity
      const yn = finite(y as number) ? (y as number) : -Infinity
      return (xn - yn) * sort.dir
    })
  }, [configs, sort])

  if (!nb || nb.available === false) return <NA why="parameterNeighborhood.available is false or the block is not in the payload" />
  if (!data || !configs.length) return <NA why={`parameterNeighborhood.${split}.configurations is empty`} />

  const policy = nb.policy
  const agg = data.aggregate
  const profiles = policy?.signalProfiles?.length
    ? policy.signalProfiles.map((p) => ({ id: p.id, label: p.label ?? p.id }))
    : [...new Set(configs.map((c) => c.signalProfile ?? ''))].map((id) => ({ id, label: id }))
  const bands = policy?.noTradeBands?.length ? policy.noTradeBands : [...new Set(configs.map((c) => c.noTradeOneWay ?? 0))].sort((a, b) => a - b)
  const at = (profile: string, band: number) => configs.find((c) => c.signalProfile === profile && c.noTradeOneWay === band)
  const maxAbs = Math.max(0.0001, ...configs.map((c) => (finite(c.netSharpe) ? Math.abs(c.netSharpe) : 0)))
  const baseId = policy?.baseConfigurationId ?? configs.find((c) => c.isBase)?.id
  const n = policy?.configurationCount ?? configs.length

  const th = (key: SortKey, label: string, right: boolean) => (
    <th key={key} scope="col" className={right ? 'r' : undefined} aria-sort={sort?.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="pf-sort" onClick={() => setSort((s) => (s?.key === key ? (s.dir === -1 ? { key, dir: 1 } : null) : { key, dir: -1 }))}>
        {label}
        <span aria-hidden="true">{sort?.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}</span>
      </button>
    </th>
  )

  return (
    <div className="vstack">
      <div className="pf-diag box">
        <p>
          <strong>{n} configurations were tried</strong> ({profiles.length} signal profiles x {bands.length} no-trade bands, predeclared, role{' '}
          <span className="mono">{policy?.role ?? '—'}</span>). The selected configuration is the base, <span className="mono">{baseId ?? '—'}</span>; the other {n - 1}{' '}
          are context only and never enter selection. The best of {n} is expected to look better than the base even when nothing is real, so read the spread, not the maximum.
        </p>
        {agg && (
          <Kv
            rows={[
              ['Base net Sharpe', fn(agg.baseNetSharpe)],
              ['Net Sharpe, min / median / max', `${fn(agg.minimumNetSharpe)} / ${fn(agg.medianNetSharpe)} / ${fn(agg.maximumNetSharpe)}`],
              ['Net Sharpe standard deviation', fn(agg.netSharpeStd)],
              ['Configurations with positive net Sharpe', up(agg.positiveNetSharpeRate, 0)],
              ['Same sign as base', up(agg.signAgreementWithBaseRate, 0)],
            ]}
          />
        )}
      </div>

      <div className="vstack">
        <figure className="pf-matrix-fig">
          <figcaption className="small muted">Net Sharpe by signal profile and no-trade band, {split} split. Shade scales with size; sign is always written.</figcaption>
          <table className="pf-matrix">
            <thead>
              <tr>
                <td />
                {bands.map((b) => (
                  <th key={b} scope="col">no-trade {b.toFixed(2)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id}>
                  <th scope="row">{p.label}</th>
                  {bands.map((b) => {
                    const c = at(p.id, b)
                    if (!c) return <td key={b}><NA why="cell missing" /></td>
                    const v = c.netSharpe
                    const a = finite(v) ? Math.round((Math.abs(v) / maxAbs) * 55) : 0
                    const bg = finite(v) ? `color-mix(in srgb, ${v >= 0 ? 'var(--ok)' : 'var(--signal-graphic)'} ${a}%, transparent)` : undefined
                    const isBase = c.id === baseId || c.isBase
                    return (
                      <td key={b} className={isBase ? 'is-base' : undefined} style={{ background: bg }} title={`${c.id}: net Sharpe ${fn(v)}, total return ${sp(c.totalReturn)}, turnover ${fn(c.annualizedOneWayTurnover, 1)}x`}>
                        <span className="pf-cell-v">
                          <Glyph kind={!finite(v) || Number(v.toFixed(2)) === 0 ? 'empty' : v > 0 ? 'supported' : 'refuted'} />
                          {sn(v)}
                        </span>
                        {isBase && <span className="pf-cell-tag">selected (base)</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </figure>

        <div className="tablewrap tablewrap--tall">
          <table className="tbl">
            <caption className="small muted">All {configs.length} configurations, {split} split. Click a header to sort.</caption>
            <thead>
              <tr>
                {th('id', 'Configuration', false)}
                {COLS.map((c) => th(c.key, c.label, true))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className={c.isBase ? 'pf-selected' : undefined}>
                  <th scope="row">
                    <span className="mono nowrap">{c.id}</span>
                    {c.isBase && <span className="badge">selected (base)</span>}
                  </th>
                  {COLS.map((col) => (
                    <td key={col.key} className="r">{col.f(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ book, exposure, attribution */

const signalWord = (s: number | undefined) => (s === 1 ? 'long' : s === -1 ? 'short' : s === 0 ? 'flat' : '—')

export function BookBlock({ pf, split, hiddenWhy }: { pf: PortfolioDiagnostics; split: Split; hiddenWhy: string | null }) {
  const b = pf.currentBook
  const attr: AttributionRow[] | undefined = pf.attribution?.[split]
  return (
    <div className="vstack">
      {hiddenWhy ? (
        <p><NA why={hiddenWhy} /></p>
      ) : !b ? (
        <p><NA why="currentBook is not in the payload" /></p>
      ) : (
        <div className="cols cols--3-2 cols--tables">
          <div className="tablewrap">
            <table className="tbl">
              <caption className="small muted">
                Book on {day(b.timestamp)}, sorted by absolute executed weight.{' '}
                {b.historicalResearchWeights ? 'These are research weights from a historical Run, not a live account.' : ''}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Asset</th>
                  <th scope="col">Signal</th>
                  <th scope="col" className="r">Executed</th>
                  <th scope="col" className="r">Target</th>
                  <th scope="col" className="r">Trade</th>
                  <th scope="col">Action</th>
                  <th scope="col" className="r">Net contribution</th>
                  <th scope="col" className="r">Variance share</th>
                </tr>
              </thead>
              <tbody>
                {[...(b.positions ?? [])]
                  .sort((x: BookPosition, y: BookPosition) => Math.abs(y.executedWeight ?? 0) - Math.abs(x.executedWeight ?? 0))
                  .map((p) => (
                    <tr key={p.asset}>
                      <th scope="row" className="nowrap">{p.asset}{p.regime && <span className="faint small">{p.regime}</span>}</th>
                      <td>{signalWord(p.signalState)}{p.signalEvent && <span className="faint small">{p.signalEvent}</span>}</td>
                      <td className="r">{sp(p.executedWeight, 1)}</td>
                      <td className="r">{sp(p.targetWeight, 1)}</td>
                      <td className="r">{sp(p.tradeWeight, 1)}</td>
                      <td>{p.executionAction ?? '—'}</td>
                      <td className="r">{sp(p.netReturnContribution, 3)}</td>
                      <td className="r">{up(p.varianceContributionShare)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <Block title="Exposure and risk on that date">
            <Kv
              rows={[
                ['Gross exposure', up(b.grossExposure)],
                ['Net exposure', up(b.netExposure)],
                ['Cash weight', up(b.cashWeight)],
                ['One-way turnover that day', up(b.oneWayTurnover)],
                ['Cost that day', up(b.cost, 3)],
                ['Forecast vol (annualized)', `${up(b.executedRiskForecastAnnualized)} of a ${up(b.executionRiskCeilingAnnualized)} ceiling`],
                ['Risk governor', `${b.riskGovernorStatus ?? '—'}, scale ${fn(b.riskGovernorScale)}`],
              ]}
            />
          </Block>
        </div>
      )}
      {attr?.length ? (
        <div className="tablewrap">
          <table className="tbl">
            <caption className="small muted">Attribution by asset, {split} split</caption>
            <thead>
              <tr>
                <th scope="col">Asset</th>
                <th scope="col" className="r">Net contribution / yr</th>
                <th scope="col" className="r">Avg |weight|</th>
                <th scope="col" className="r">Variance share</th>
                <th scope="col" className="r">Cost</th>
                <th scope="col" className="r">Turnover contribution</th>
              </tr>
            </thead>
            <tbody>
              {attr.map((a) => (
                <tr key={a.asset}>
                  <th scope="row">{a.asset}</th>
                  <td className="r">{sp(a.annualizedNetContribution)}</td>
                  <td className="r">{up(a.averageAbsoluteWeight)}</td>
                  <td className="r">{up(a.meanVarianceContributionShare)}</td>
                  <td className="r">{up(a.totalCostContribution, 2)}</td>
                  <td className="r">{fn(a.totalOneWayTurnoverContribution)}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p><NA why={`attribution.${split} is not in the payload`} /></p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ transitions and episodes */

export function TransitionsTable({ rows, total }: { rows: Transition[]; total: number }) {
  if (!rows.length) return <NA why="no recent transition remains after the visibility rule, or the payload lists none" />
  return (
    <div className="tablewrap tablewrap--tall">
      <table className="tbl">
        <caption className="small muted">
          {rows.length} of the server&apos;s {total} most recent signal transitions (older ones are not published)
        </caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Asset</th>
            <th scope="col">Event</th>
            <th scope="col">State</th>
            <th scope="col" className="r">Executed weight</th>
            <th scope="col" className="r">Trade</th>
            <th scope="col">Action</th>
            <th scope="col">Reason</th>
            <th scope="col">Regime</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.timestamp}${r.asset}${i}`}>
              <td className="mono">{day(r.timestamp)}</td>
              <th scope="row">{r.asset}</th>
              <td>{r.signalEvent ?? '—'}</td>
              <td>{signalWord(r.priorSignalState)} to {signalWord(r.signalState)}</td>
              <td className="r">{sp(r.executedWeight, 1)}</td>
              <td className="r">{sp(r.tradeWeight, 1)}</td>
              <td>{r.executionAction ?? '—'}</td>
              <td className="muted">{r.executionReason ?? '—'}</td>
              <td className="muted">{r.regime ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const episodeStatus = (e: Episode) => (e.complete ? 'complete' : [e.leftCensored && 'left-censored', e.rightCensored && 'right-censored'].filter(Boolean).join(', ') || 'open')

export function EpisodesTable({ rows, total }: { rows: Episode[]; total: number }) {
  if (!rows.length) return <NA why="no recent episode remains after the visibility rule, or the payload lists none" />
  return (
    <div className="tablewrap tablewrap--tall">
      <table className="tbl">
        <caption className="small muted">
          {rows.length} of the server&apos;s {total} most recent position episodes. Contributions are additive portfolio returns after trade cost, clipped to the split.
        </caption>
        <thead>
          <tr>
            <th scope="col">Split</th>
            <th scope="col">Asset</th>
            <th scope="col">Side</th>
            <th scope="col">Entry</th>
            <th scope="col">Exit</th>
            <th scope="col" className="r">Bars</th>
            <th scope="col" className="r">Net contribution</th>
            <th scope="col" className="r">Cost</th>
            <th scope="col" className="r">Best excursion</th>
            <th scope="col" className="r">Worst excursion</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td>{e.split ?? '—'}</td>
              <th scope="row">{e.asset ?? '—'}</th>
              <td>{e.side ?? '—'}</td>
              <td className="mono">{day(e.entryTimestamp)}</td>
              <td className="mono">{e.exitTimestamp ? day(e.exitTimestamp) : <span className="faint">{e.exitAction ?? 'open'}</span>}</td>
              <td className="r">{e.decisionBars ?? '—'}</td>
              <td className="r">{sp(e.netContribution, 3)}</td>
              <td className="r">{up(e.totalCost, 3)}</td>
              <td className="r">{sp(e.maximumFavorableExcursion, 3)}</td>
              <td className="r">{sp(e.maximumAdverseExcursion, 3)}</td>
              <td className="muted">{episodeStatus(e)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
