import { translate, uiTemplate, uiText, uiValue, useLanguage, getLanguage } from '../../i18n'
import type { FactorCumulativePoint } from '../../api'
import { routeHref } from '../../route'
import { CompactTile, CompactTileGrid } from '../../components/CompactTile'
import { ChartCard } from '../../components/workbench'
import { DiagnosticText } from '../../components/DiagnosticText'
import { curveSign, SignedCurve, type CurvePoint } from '../../components/SignedCurve'
import { GroupLegend, GroupPlot, GroupTable, groupCurvePoints } from '../GroupReturn'
import { niceTicks } from '../factorMath'
import { studyTestVisible } from '../testGate'
import { PathTable } from '../portfolio/PortfolioChart'
import { finite } from '../portfolio/pfmt'
import type { PathPoint } from '../portfolio/portfolioTypes'
import { useRun, type RunLoad } from '../run/useRun'
import { BeforeAfterView } from './BeforeAfter'
import {
  cardLane, completedTrialTable, factorCardMetrics, portfolioCardMetrics, portfolioCurvePoints,
  type CardMetric, type RunRef, type TrialTable,
} from './resultModel'
import type { SnapshotLoad } from './useProjectSnapshots'

/**
 * The compact result card an Assistant turn shows for a Run it produced or linked: five published numbers (each with its
 * catalogue explanation), one cumulative-growth chart, the before/after table for a counted trial, and the way to the full
 * evidence page. Studio presents only: a value the server does not publish is shown as "Not published", never a placeholder number.
 */

const L = (en: string, zh: string): string => translate(getLanguage(), en, zh)

export type CardChart =
  | { kind: 'factor'; points: FactorCumulativePoint[]; horizon?: number; testShown: boolean }
  | { kind: 'portfolio'; points: PathPoint[] }
  | { kind: 'none'; reason: string }

export type CardData = {
  laneWord: string
  status: string | null
  /** Which split the numbers describe. */
  scope: string
  metrics: CardMetric[]
  chart: CardChart
  /** A short server-grounded explanation shown under the numbers (for example why they are not published). */
  note?: string
}

export type CardState = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; data: CardData }

const loading = (): CardState => ({ kind: 'loading' })

/** Pure: everything the card shows, from the Project snapshot and (for a Factor Run) the Run payload. */
export function cardStateFor(runId: string, snapshot: SnapshotLoad | undefined, run: RunLoad): CardState {
  if (!snapshot || snapshot.state === 'loading') return loading()
  if (snapshot.state === 'error') return { kind: 'error', message: snapshot.message }
  const project = snapshot.project
  const { lane, name } = cardLane(project, runId)
  const status = project.runs.find((row) => row.id === runId)?.status ?? null
  const scope = uiText('Validation · development')

  if (lane === 'portfolio') {
    const explorer = project.portfolioExplorer?.run?.id === runId ? project.portfolioExplorer : null
    const points = portfolioCurvePoints(explorer)
    return {
      kind: 'ready',
      data: {
        laneWord: L('Portfolio Run', '组合运行'),
        status,
        scope,
        metrics: portfolioCardMetrics(project, runId),
        chart: points.length >= 2
          ? { kind: 'portfolio', points }
          : { kind: 'none', reason: explorer ? L('No net curve is published for this Run.', '这次运行没有发布净值曲线。') : L('The Project snapshot publishes the net curve only for its latest Portfolio Run.', '项目快照只发布最新一次组合运行的净值曲线。') },
        ...(explorer ? {} : { note: L('Per-Run numbers come from the Project snapshot, which carries only the latest Portfolio Run.', '单次运行的数字来自项目快照，而快照只带有最新一次组合运行。') }),
      },
    }
  }
  if (lane === 'other') {
    return {
      kind: 'ready',
      data: {
        laneWord: uiValue(name ?? L('Run', '运行')),
        status,
        scope,
        metrics: [],
        chart: { kind: 'none', reason: L('This lane keeps its figures on the full evidence page.', '这个研究方向的图表在完整证据页中。') },
      },
    }
  }

  if (run.state === 'idle' || run.state === 'loading') return loading()
  if (run.state === 'error') return { kind: 'error', message: run.message }
  const fe = run.payload.factorExplorer
  const points = groupCurvePoints(fe)
  return {
    kind: 'ready',
    data: {
      laneWord: L('Factor Run', '因子运行'),
      status: status ?? fe.run?.status ?? null,
      scope,
      metrics: factorCardMetrics(fe, project, runId),
      chart: points.length >= 2
        ? { kind: 'factor', points, horizon: fe.quantilePath?.cumulative?.horizon, testShown: studyTestVisible(fe) }
        : { kind: 'none', reason: L('The server does not publish group return curves for this Run.', '服务端没有发布这次运行的分组收益曲线。') },
    },
  }
}

const pm = { l: 52, r: 14, t: 16, b: 32 }
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** The Portfolio Run's net growth path (growth of 1.0, after costs) drawn from its published sampled points. Test-split points are removed before this is called. */
export function PortfolioNetPlot({ points, width: W, height: H, label }: { points: PathPoint[]; width: number; height: number; label: string }) {
  const t = points.map((p) => Date.parse(p.timestamp))
  const t0 = t[0]
  const t1 = t[t.length - 1]
  const values = points.map((p) => p.netGrowth).filter(finite)
  const ticks = niceTicks(Math.min(1, ...values), Math.max(1, ...values), 4)
  const lo = Math.min(ticks[0], ...values)
  const hi = Math.max(ticks[ticks.length - 1], ...values)
  const x = (ms: number) => pm.l + ((ms - t0) / (t1 - t0 || 1)) * (W - pm.l - pm.r)
  const y = (v: number) => pm.t + ((hi - v) / (hi - lo || 1)) * (H - pm.t - pm.b)
  const curve: CurvePoint[] = points.flatMap((p, i): CurvePoint[] => (finite(p.netGrowth) ? [[x(t[i]), y(p.netGrowth)]] : []))
  const last = values[values.length - 1]
  return (
    <svg className="plot plot--fill" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={pm.l} x2={W - pm.r} y1={y(v)} y2={y(v)} stroke="var(--grid)" strokeWidth="1" opacity={v === 1 ? 1 : 0.5} strokeDasharray={v === 1 ? undefined : '2 3'} />
          <text x={pm.l - 8} y={y(v) + 4} textAnchor="end" className="ax">{v.toFixed(2)}</text>
        </g>
      ))}
      <SignedCurve pts={curve} baseY={y(1)} x0={pm.l} x1={W - pm.r} top={pm.t} bottom={H - pm.b} width={2.2} casing />
      <text x={pm.l} y={H - 8} textAnchor="start" className="ax faint">{day(t0)}</text>
      <text x={W - pm.r} y={H - 8} textAnchor="end" className="ax faint">{day(t1)}</text>
      {finite(last) && <text x={W - pm.r - 4} y={y(last) + (last >= 1 ? 18 : -8)} textAnchor="end" className="val end-label" data-sign={curveSign([last], 1)}>{last.toFixed(3)}</text>}
    </svg>
  )
}

function CardChartView({ chart }: { chart: CardChart }) {
  if (chart.kind === 'factor') {
    return (
      <ChartCard
        title={uiText('Group cumulative return')}
        subtitle={uiText('Published group growth, before costs.')}
        legend={<GroupLegend testShown={chart.testShown} />}
        table={<GroupTable points={chart.points} />}
        minHeight={180}
      >
        {({ width, height }) => (
          <GroupPlot
            points={chart.points}
            width={width}
            height={height}
            label={uiTemplate('Low, middle and high factor groups compounded at {0}-bar horizon, gross of costs, plus the high-minus-low long-short curve.', [chart.horizon ?? 1])}
          />
        )}
      </ChartCard>
    )
  }
  if (chart.kind === 'portfolio') {
    return (
      <ChartCard
        title={L('Net growth', '净值增长')}
        subtitle={uiText('Growth of 1.0 at the first date, after costs (not currency; initial capital is not published for the path).')}
        table={<PathTable points={chart.points} />}
        minHeight={180}
      >
        {({ width, height }) => (
          <PortfolioNetPlot points={chart.points} width={width} height={height} label={uiText('Growth of 1.0 at the first date, after costs (not currency; initial capital is not published for the path).')} />
        )}
      </ChartCard>
    )
  }
  return <p className="assistant-subtle assistant-result-nochart"><span className="faint">{uiText('Not published')}</span> · {chart.reason}</p>
}

/** The card as pure markup: every state it can be in, no data fetching. */
export function ResultCardView({ project, run, state, table }: { project: string; run: string; state: CardState; table?: TrialTable | null }) {
  const language = useLanguage()
  const t = (en: string, zh: string) => translate(language, en, zh)
  const data = state.kind === 'ready' ? state.data : null
  return (
    <article className="assistant-result ch" aria-live="off" aria-label={t(`Result card for Run ${run}`, `运行 ${run} 的结果卡`)}>
      <header className="assistant-result-head">
        <span className="mk" translate="no">RESULT</span>
        {data && <strong>{data.laneWord}</strong>}
        <code className="mono" translate="no">{run}</code>
        {data?.status && <span className="assistant-result-status">{uiValue(data.status)}</span>}
      </header>
      {state.kind === 'loading' && <p className="assistant-subtle" role="status">{t('Loading the published result…', '正在加载已发布的结果…')}</p>}
      {state.kind === 'error' && <p className="assistant-subtle" role="status">{t('This result could not be loaded: ', '无法加载这个结果：')}<DiagnosticText value={state.message} error /></p>}
      {data && (
        <>
          {data.metrics.length > 0 && (
            <>
              <p className="assistant-subtle assistant-result-scope">{data.scope}</p>
              <CompactTileGrid label={t('Result metrics', '结果指标')}>
                {data.metrics.map((metric) => (
                  <CompactTile
                    key={metric.id}
                    label={metric.label}
                    value={metric.value ?? '—'}
                    metric={metric.id}
                    note={metric.value === null ? uiText('Not published') : metric.note}
                  />
                ))}
              </CompactTileGrid>
            </>
          )}
          {data.note && <p className="assistant-subtle">{data.note}</p>}
          <CardChartView chart={data.chart} />
        </>
      )}
      {table && <BeforeAfterView table={table} />}
      <a className="abtn abtn--primary assistant-result-link" href={routeHref({ view: 'run', id: project, run })}>{t('Open full evidence', '打开完整证据')}</a>
    </article>
  )
}

/** Loads what the card needs (the Run payload for a Factor Run; the Project snapshot is shared across cards) and shows it. */
export function ResultCard({ item, snapshot }: { item: RunRef; snapshot: SnapshotLoad | undefined }) {
  useLanguage() // The card text is built from the published numbers at render time; re-render when the language switches.
  const project = snapshot?.state === 'ready' ? snapshot.project : null
  const lane = project ? cardLane(project, item.run).lane : null
  const run = useRun(item.project, lane === 'factor' ? item.run : undefined)
  const table = item.experimentId ? completedTrialTable(project, item.experimentId) : null
  return <ResultCardView project={item.project} run={item.run} state={cardStateFor(item.run, snapshot, run)} table={table} />
}

/** Cards shown per chat turn; older ones stay reachable under Artifacts. */
export const MAX_CARDS_PER_TURN = 3

/** The cards of one chat turn: the latest few Runs it recorded, each with its own card. */
export function TurnCards({ refs, snapshots }: { refs: RunRef[]; snapshots: Record<string, SnapshotLoad> }) {
  const language = useLanguage()
  const t = (en: string, zh: string) => translate(language, en, zh)
  const shown = refs.slice(-MAX_CARDS_PER_TURN)
  const hidden = refs.length - shown.length
  return (
    <div className="assistant-results" aria-live="off">
      {hidden === 1 && <p className="assistant-subtle">{t('1 earlier Run from this turn is listed under Artifacts.', '本轮另有 1 个较早的运行，列在“研究成果”中。')}</p>}
      {hidden > 1 && <p className="assistant-subtle">{t(`${hidden} earlier Runs from this turn are listed under Artifacts.`, `本轮另有 ${hidden} 个较早的运行，列在“研究成果”中。`)}</p>}
      {shown.map((ref) => <ResultCard key={ref.project + ':' + ref.run} item={ref} snapshot={snapshots[ref.project]} />)}
    </div>
  )
}
