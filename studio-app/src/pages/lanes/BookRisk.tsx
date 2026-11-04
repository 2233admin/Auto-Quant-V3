import { coreWord, uiTemplate, uiText } from '../../i18n'
import type { ProjectSnapshot } from '../../api'
import { Info } from '../../components/Info'
import { MetricTile } from '../../components/MetricTile'
import { HeroLine, HeroTiles, type HeroTile } from '../hero'
import { Section, SectionNav } from '../../design/layout'
import { Block, day, finite, fn, Kv, sn, sp, up } from '../portfolio/pfmt'
import { LaneChart, type ChartSeries } from './LaneChart'
import { ArtifactList, LaneEmpty, LaneHead, Na, NaBox, ShareBars, StatusBand, WeightsTable, type Reason } from './laneParts'
import type { BookRiskDiagnostics, Drawdown, Scenario, Sizing } from './laneTypes'
import '../../components/components.css'

const words = coreWord
const n0 = (v: number | null | undefined) => (finite(v) ? String(Math.round(v)) : '—')

/** The server's own sizing enum is the only status this lane publishes; everything else is descriptive. */
function statusOf(sizing: Sizing | undefined): { word: string; glyph: 'supported' | 'error' | 'empty'; signal: boolean } {
  if (!sizing || sizing.status === 'not-requested') return { word: uiText("Descriptive audit"), glyph: 'empty', signal: false }
  const ok = sizing.result?.ceilingSatisfied === true
  return { word: words(sizing.status).replace(/^./, (c) => c.toUpperCase()), glyph: ok ? 'supported' : 'error', signal: !ok }
}

function coreTiles(x: BookRiskDiagnostics): HeroTile[] {
  const c = x.current
  const primary = x.lookbacks?.find((l) => Number(l.lookbackBars) === Number(c.lookbackBars))
  const holdings = Object.keys(x.positionSnapshot.weights ?? {}).length
  return [
    { label: uiText("Annualized volatility"), value: up(c.annualizedVolatility, 2), note: uiTemplate("{0} aligned returns", [n0(c.observations)]) },
    { label: uiText("Effective risk bets"), value: fn(c.effectiveRiskBets), note: uiTemplate("{0} reported holdings", [holdings]) },
    { label: uiText("First principal component"), value: up(c.firstPrincipalComponentVarianceShare, 1), note: uiText("correlation crowding") },
    { label: uiText("Component-risk HHI"), value: fn(c.componentRiskHhi, 3), note: uiText("lower is more diversified") },
    { label: uiText("Largest contributor"), value: primary?.largestAbsoluteRiskContributor ?? '—', note: uiTemplate("{0} of absolute risk", [up(c.largestAbsoluteRiskContributorShare, 1)]) },
    { label: uiText("Max drawdown"), value: sp(c.maximumDrawdown, 2), note: uiText("constant weights") },
  ]
}

function Tiles({ x }: { x: BookRiskDiagnostics }) {
  const c = x.current
  const primary = x.lookbacks?.find((l) => Number(l.lookbackBars) === Number(c.lookbackBars))
  const first = x.reductionPriority?.[0]
  const holdings = Object.keys(x.positionSnapshot.weights ?? {}).length
  return (
    <dl className="lane-tiles">
      <MetricTile label={uiText("Annualized volatility")} value={up(c.annualizedVolatility, 2)} note={uiTemplate("{0} aligned returns", [n0(c.observations)])} definition="Volatility of the reported book under the historical covariance of the primary window." />
      <MetricTile label={uiText("Effective risk bets")} value={fn(c.effectiveRiskBets)} note={uiTemplate("{0} reported holdings", [holdings])} definition="The server's count of independent risk bets implied by the component-risk concentration. Fewer than the holding count means risk is concentrated." />
      <MetricTile label={uiText("First principal component")} value={up(c.firstPrincipalComponentVarianceShare, 1)} note={uiText("correlation crowding")} definition="Share of return variance carried by the single largest common factor of the holdings." />
      <MetricTile label={uiText("Component-risk HHI")} value={fn(c.componentRiskHhi, 3)} note={uiText("lower is more diversified")} definition="Herfindahl index of component-risk shares." />
      <MetricTile label={uiText("Largest contributor")} value={primary?.largestAbsoluteRiskContributor ?? '—'} note={uiTemplate("{0} of absolute risk", [up(c.largestAbsoluteRiskContributorShare, 1)])} />
      <MetricTile label={uiText("First reduction")} value={first?.asset ?? '—'} note={uiTemplate("{0} vol per unit weight", [fn(first?.volatilityReductionPerWeight, 3)])} definition="Asset whose standardized 1% cash-funded reduction lowers volatility the most per unit of weight." />
      <MetricTile label={uiText("Gross / net exposure")} value={`${up(c.grossExposure, 1)} / ${up(c.netExposure, 1)}`} note={uiText("reported snapshot")} />
      <MetricTile label={uiText("Cash weight")} value={up(c.cashWeight, 1)} note={x.positionSnapshot.baseCurrency} />
      <MetricTile label={uiText("Max drawdown")} value={sp(c.maximumDrawdown, 2)} note={uiTemplate("constant weights, {0} → {1}", [day(x.drawdown?.peakTimestamp), day(x.drawdown?.troughTimestamp)])} definition="Close-to-close research path of the reported weights held constant. Not the account's own history." />
      <MetricTile label={uiText("Primary window")} value={`${n0(c.lookbackBars)} bars`} note={uiText("all headline numbers use it")} />
    </dl>
  )
}

function Contributions({ x, part = 'both' }: { x: BookRiskDiagnostics; part?: 'bars' | 'table' | 'both' }) {
  const rows = x.riskContributions ?? []
  if (!rows.length) return <NaBox why="riskContributions is not in the payload" />
  return (
    <div className="vstack">
      {part !== 'table' && (
      <ShareBars
        label={uiText("Absolute risk share by holding")}
        fillLabel="Bar: absolute risk share"
        markLabel="Tick: reported weight"
        rows={rows.map((r) => ({ name: r.asset, share: r.absoluteRiskShare, mark: r.weight, text: uiTemplate("{0} risk · {1} weight", [up(r.absoluteRiskShare, 1), up(r.weight, 1)]) }))}
      />
      )}
      {part !== 'bars' && (
      <div className="tablewrap lane-narrow">
        <table className="tbl">
          <thead>
            <tr>
              <th scope="col">{uiText("Asset")}</th>
              <th scope="col" className="r">{uiText("Reported weight")}</th>
              <th scope="col" className="r">{uiText("Absolute risk share")}</th>
              <th scope="col" className="r">{uiText("Signed risk share")}</th>
              <th scope="col" className="r">{uiText("Component variance")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.asset}>
                <td className="mono">{r.asset}</td>
                <td className="r">{up(r.weight, 1)}</td>
                <td className="r">{up(r.absoluteRiskShare, 1)}</td>
                <td className="r">{sp(r.signedRiskShare, 1)}</td>
                <td className="r">{finite(r.componentVariance) ? r.componentVariance.toExponential(2) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  )
}

function Reductions({ x }: { x: BookRiskDiagnostics }) {
  const rows = x.reductionPriority ?? []
  if (!rows.length) return <NaBox why="reductionPriority is not in the payload" />
  return (
    <div className="tablewrap">
      <table className="tbl">
        <thead>
          <tr>
            <th scope="col">{uiText("Priority")}</th>
            <th scope="col">{uiText("Asset")}</th>
            <th scope="col" className="r">{uiText("Weight")}</th>
            <th scope="col" className="r">{uiText("Reduction")}</th>
            <th scope="col" className="r">{uiText("Volatility reduction")}</th>
            <th scope="col" className="r">{uiText("Per unit weight")}</th>
            <th scope="col" className="r">{uiText("Resulting volatility")}</th>
            <th scope="col" className="r">{uiText("Resulting HHI")}</th>
            <th scope="col" className="r">{uiText("Resulting eff. bets")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.asset}>
              <td className="mono">{n0(r.rank)}</td>
              <td className="mono">{r.asset}</td>
              <td className="r">{up(r.startingWeight, 1)} → {up(r.resultingWeight, 1)}</td>
              <td className="r">{up(r.weightReduction, 1)}</td>
              <td className="r">{up(r.volatilityReduction, 3)}</td>
              <td className="r">{fn(r.volatilityReductionPerWeight, 3)}</td>
              <td className="r">{up(r.annualizedVolatility, 2)}</td>
              <td className="r">{fn(r.componentRiskHhi, 3)}</td>
              <td className="r">{fn(r.effectiveRiskBets)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Windows({ x }: { x: BookRiskDiagnostics }) {
  const rows = x.lookbacks ?? []
  if (!rows.length) return <NaBox why="lookbacks is not in the payload" />
  return (
    <div className="tablewrap">
      <table className="tbl">
        <thead>
          <tr>
            <th scope="col">{uiText("Window")}</th>
            <th scope="col" className="r">{uiText("Observations")}</th>
            <th scope="col" className="r">{uiText("Volatility")}</th>
            <th scope="col" className="r">{uiText("Effective bets")}</th>
            <th scope="col" className="r">{uiText("Component-risk HHI")}</th>
            <th scope="col" className="r">{uiText("First PC")}</th>
            <th scope="col">{uiText("Largest contributor")}</th>
            <th scope="col">{uiText("First reduction")}</th>
            <th scope="col" className="r">{uiText("Max drawdown")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const primary = Number(r.lookbackBars) === Number(x.current.lookbackBars)
            return (
              <tr key={r.lookbackBars} className={primary ? 'pf-selected' : undefined}>
                <td className="mono">
                  {n0(r.lookbackBars)}{uiText(" bars")}{primary && <span className="badge">{uiText("primary")}</span>}
                </td>
                <td className="r">{n0(r.observations)}</td>
                <td className="r">{up(r.annualizedVolatility, 2)}</td>
                <td className="r">{fn(r.effectiveRiskBets)}</td>
                <td className="r">{fn(r.componentRiskHhi, 3)}</td>
                <td className="r">{up(r.firstPrincipalComponentVarianceShare, 1)}</td>
                <td><span className="mono">{r.largestAbsoluteRiskContributor ?? '—'}</span> <span className="faint small">{up(r.largestAbsoluteRiskContributorShare, 1)}</span></td>
                <td><span className="mono">{r.firstReductionAsset ?? '—'}</span> <span className="faint small">{fn(r.firstReductionVolatilityPerWeight, 3)}{uiText(" / weight")}</span></td>
                <td className="r">{sp(r.maximumDrawdown, 2)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Correlations({ x }: { x: BookRiskDiagnostics }) {
  const pairs = x.pairwiseCorrelations ?? []
  if (!pairs.length) return <NaBox why="pairwiseCorrelations is not in the payload (a one-holding book has no pair)" />
  const order = Object.keys(x.positionSnapshot.weights ?? {})
  const assets = [...new Set([...order, ...pairs.flatMap((p) => [p.leftAsset, p.rightAsset])])].filter((a) => pairs.some((p) => p.leftAsset === a || p.rightAsset === a))
  const get = (a: string, b: string) => pairs.find((p) => (p.leftAsset === a && p.rightAsset === b) || (p.leftAsset === b && p.rightAsset === a))?.correlation
  const byStrength = pairs.slice().sort((l, r) => Math.abs(r.correlation ?? 0) - Math.abs(l.correlation ?? 0))
  return (
    <div className="vstack">
      <table className="lane-corr">
        <caption className="small muted" style={{ textAlign: 'left' }}>{uiText("Pairwise return correlation over the primary window. Cell shade is the absolute value; the signed number is always printed.")}</caption>
        <thead>
          <tr>
            <th scope="col"><span className="sr-only">{uiText("Asset")}</span></th>
            {assets.map((a) => (
              <th key={a} scope="col">{a}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {assets.map((row) => (
            <tr key={row}>
              <th scope="row">{row}</th>
              {assets.map((col) => {
                if (row === col) return <td key={col} className="self">—</td>
                const c = get(row, col)
                const shade = finite(c) ? Math.min(100, Math.abs(c) * 80) : 0
                return (
                  <td key={col} style={{ background: `color-mix(in srgb, var(--stroke) ${shade}%, transparent)` }}>
                    {sn(c, 2)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <details className="datatable">
        <summary>{uiText("Pairs by absolute correlation")}</summary>
        <div className="tablewrap lane-narrow">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">{uiText("Pair")}</th>
                <th scope="col" className="r">{uiText("Correlation")}</th>
              </tr>
            </thead>
            <tbody>
              {byStrength.map((p) => (
                <tr key={`${p.leftAsset}/${p.rightAsset}`}>
                  <td className="mono">{p.leftAsset} / {p.rightAsset}</td>
                  <td className="r">{sn(p.correlation, 3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}

function Scenarios({ x }: { x: BookRiskDiagnostics }) {
  const cmp = x.scenarioComparison
  const scenarios = cmp?.scenarios ?? []
  if (!scenarios.length) {
    return <NaBox why="the caller supplied no hypothetical books, so the Run audits only the reported baseline and the fixed cash-funded reductions" />
  }
  const bars = Number(x.current.lookbackBars)
  const rows = scenarios
    .map((s: Scenario) => ({ s, cur: s.lookbacks.find((l) => Number(l.lookbackBars) === bars) }))
    .sort((l, r) => (l.cur?.volatilityRank ?? Infinity) - (r.cur?.volatilityRank ?? Infinity))
  const baseline = cmp?.baselineLookbacks?.find((l) => Number(l.lookbackBars) === bars)
  const contribs = rows.flatMap(({ s }) => s.primaryContributions.map((c) => ({ ...c, scenarioName: s.name })))
  return (
    <div className="vstack">
      <p className="muted small lane-note">{uiText("Ranked by ")}{words(cmp?.ranking?.metric)} ({cmp?.ranking?.direction ?? '—'}{uiText(" first).")}<Info label={uiText("About this ranking")}>
          <p>{uiText("Selection authority: ")}<span className="mono">{cmp?.ranking?.selectionAuthority ?? '—'}</span>{uiText(". The ranking describes the supplied books only; it does not pick one.")}</p>
        </Info>
      </p>
      <div className="tablewrap">
        <table className="tbl">
          <thead>
            <tr>
              <th scope="col">{uiText("Vol rank")}</th>
              <th scope="col">{uiText("Supplied book")}</th>
              <th scope="col" className="r">{uiText("Volatility")}</th>
              <th scope="col" className="r">{uiText("Δ vs baseline")}</th>
              <th scope="col" className="r">{uiText("Risk HHI")}</th>
              <th scope="col" className="r">{uiText("HHI Δ")}</th>
              <th scope="col" className="r">{uiText("Effective bets")}</th>
              <th scope="col" className="r">{uiText("Bets Δ")}</th>
              <th scope="col">{uiText("Largest contributor")}</th>
            </tr>
          </thead>
          <tbody>
            {baseline && (
              <tr>
                <td className="mono">—</td>
                <td>{uiText("Reported baseline")}</td>
                <td className="r">{up(baseline.annualizedVolatility, 2)}</td>
                <td className="r">—</td>
                <td className="r">{fn(x.current.componentRiskHhi, 3)}</td>
                <td className="r">—</td>
                <td className="r">{fn(x.current.effectiveRiskBets)}</td>
                <td className="r">—</td>
                <td>—</td>
              </tr>
            )}
            {rows.map(({ s, cur }) => (
              <tr key={s.id}>
                <td className="mono">{n0(cur?.volatilityRank)}</td>
                <td>{s.name}<span className="faint small mono"> {s.id}</span></td>
                <td className="r">{up(cur?.annualizedVolatility, 2)}</td>
                <td className="r">{sp(cur?.annualizedVolatilityDelta, 2)}</td>
                <td className="r">{fn(cur?.componentRiskHhi, 3)}</td>
                <td className="r">{sn(cur?.componentRiskHhiDelta, 3)}</td>
                <td className="r">{fn(cur?.effectiveRiskBets)}</td>
                <td className="r">{sn(cur?.effectiveRiskBetsDelta, 2)}</td>
                <td><span className="mono">{cur?.largestAbsoluteRiskContributor ?? '—'}</span> <span className="faint small">{up(cur?.largestAbsoluteRiskContributorShare, 1)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="datatable">
        <summary>{uiText("Per-asset contributions, baseline to scenario (")}{contribs.length}{uiText(" rows)")}</summary>
        <div className="tablewrap tablewrap--tall">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">{uiText("Supplied book")}</th>
                <th scope="col">{uiText("Asset")}</th>
                <th scope="col" className="r">{uiText("Weight baseline → scenario")}</th>
                <th scope="col" className="r">{uiText("Weight Δ")}</th>
                <th scope="col" className="r">{uiText("Risk share baseline → scenario")}</th>
                <th scope="col" className="r">{uiText("Risk-share Δ")}</th>
              </tr>
            </thead>
            <tbody>
              {contribs.map((c, i) => (
                <tr key={`${c.scenarioId}-${c.asset}-${i}`}>
                  <td>{c.scenarioName}</td>
                  <td className="mono">{c.asset}</td>
                  <td className="r">{up(c.baselineWeight, 1)} → {up(c.scenarioWeight, 1)}</td>
                  <td className="r">{sp(c.weightDelta, 1)}</td>
                  <td className="r">{up(c.baselineAbsoluteRiskShare, 1)} → {up(c.scenarioAbsoluteRiskShare, 1)}</td>
                  <td className="r">{sp(c.absoluteRiskShareDelta, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}

function SizingBlock({ sizing }: { sizing: Sizing | undefined }) {
  if (!sizing || sizing.status === 'not-requested') {
    return <NaBox why="the caller requested no caller-bounded target-position sizing, so the Run publishes none" />
  }
  const p = sizing.policy
  const r = sizing.result
  return (
    <div className="vstack">
      <dl className="lane-tiles">
        <MetricTile label={uiText("Status")} value={words(sizing.status)} note={words(sizing.resultMeaning)} />
        <MetricTile label={uiText("Allowed leg")} value={r?.asset ?? p?.asset ?? '—'} note={uiTemplate("{0} against cash only", [p?.direction ?? '—'])} />
        <MetricTile label={uiText("Weight")} value={`${up(r?.startingWeight, 1)} → ${up(r?.resultingWeight, 1)}`} note={uiTemplate("{0} holding change", [sp(r?.weightChange, 1)])} />
        <MetricTile label={uiText("Cash")} value={`${up(r?.startingCashWeight, 1)} → ${up(r?.resultingCashWeight, 1)}`} note={uiTemplate("{0} cash change", [sp(r?.cashWeightChange, 1)])} />
        <MetricTile label={uiText("Modeled volatility")} value={up(r?.annualizedVolatility, 2)} note={uiTemplate("{0} ceiling, {1} bars", [up(p?.annualizedVolatilityCeiling, 2), n0(p?.lookbackBars)])} />
        <MetricTile
          label={uiText("Ceiling")}
          value={r?.ceilingSatisfied ? 'satisfied' : 'not reachable'}
          note={uiTemplate("binding: {0}", [words(sizing.bindingConstraint)])}
          tone={r?.ceilingSatisfied ? 'neutral' : 'weak'}
          toneReason={r?.ceilingSatisfied ? undefined : 'weight bound blocks it'}
        />
      </dl>
      <p className="muted small lane-note">
        {finite(p?.minimumWeight) ? uiTemplate("Weight bound: minimum {0}", [up(p?.minimumWeight, 1)]) : finite(p?.maximumWeight) ? uiTemplate("Weight bound: maximum {0}", [up(p?.maximumWeight, 1)]) : uiText("Weight bound not published")}.
        <Info label={uiText("About this sizing")}>
          <p>{uiText("Historical covariance only; authority ")}<span className="mono">{p?.authority?.decisionPath ?? '—'}</span>{uiText(", trading ")}<span className="mono">{p?.authority?.tradingAuthority ?? '—'}</span>.
          </p>
        </Info>
      </p>
      <div className="tablewrap">
        <table className="tbl">
          <caption className="small muted">{uiText("Sizing result under every window")}</caption>
          <thead>
            <tr>
              <th scope="col">{uiText("Window")}</th>
              <th scope="col" className="r">{uiText("Volatility")}</th>
              <th scope="col" className="r">{uiText("Δ vs baseline")}</th>
              <th scope="col">{uiText("Ceiling")}</th>
              <th scope="col" className="r">{uiText("Effective bets")}</th>
              <th scope="col">{uiText("Largest contributor")}</th>
            </tr>
          </thead>
          <tbody>
            {(sizing.lookbacks ?? []).map((l) => (
              <tr key={l.lookbackBars} className={l.governing ? 'pf-selected' : undefined}>
                <td className="mono">{n0(l.lookbackBars)}{uiText(" bars")}{l.governing && <span className="badge">{uiText("governing")}</span>}</td>
                <td className="r">{up(l.annualizedVolatility, 2)}</td>
                <td className="r">{sp(l.annualizedVolatilityDelta, 2)}</td>
                <td>{l.ceilingSatisfied ? uiText("satisfied") : uiText("not satisfied")}</td>
                <td className="r">{fn(l.effectiveRiskBets)}</td>
                <td><span className="mono">{l.largestAbsoluteRiskContributor ?? '—'}</span> <span className="faint small">{up(l.largestAbsoluteRiskContributorShare, 1)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(sizing.contributions ?? []).length > 0 && (
        <details className="datatable">
          <summary>{uiText("Holdings after sizing")}</summary>
          <div className="tablewrap lane-narrow">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">{uiText("Asset")}</th>
                  <th scope="col" className="r">{uiText("Weight before → after")}</th>
                  <th scope="col" className="r">{uiText("Absolute risk share")}</th>
                  <th scope="col" className="r">{uiText("Signed risk share")}</th>
                </tr>
              </thead>
              <tbody>
                {(sizing.contributions ?? []).map((c) => (
                  <tr key={c.asset}>
                    <td className="mono">{c.asset}</td>
                    <td className="r">{up(c.baselineWeight, 1)} → {up(c.resultingWeight, 1)}</td>
                    <td className="r">{up(c.absoluteRiskShare, 1)}</td>
                    <td className="r">{sp(c.signedRiskShare, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  )
}

function DrawdownFacts({ d }: { d: Drawdown | undefined }) {
  if (!d) return <Na why="drawdown is not in the payload" />
  return (
    <Kv
      rows={[
        ['Maximum drawdown', sp(d.maximumDrawdown, 2)],
        ['Peak to trough', `${day(d.peakTimestamp)} to ${day(d.troughTimestamp)}`],
        ['Recovered', d.recovered ? `yes, on ${day(d.recoveryTimestamp)}` : 'no, the path has not regained its peak'],
        ['Method', words(d.method)],
        ['Convention', d.returnConvention ?? '—'],
      ]}
    />
  )
}

export function BookRiskPage({ project }: { project: ProjectSnapshot }) {
  const x = project.bookRiskExplorer as BookRiskDiagnostics | null
  if (!x) return <LaneEmpty title={uiText("Book Risk")} projectId={project.id} projectName={project.name} what="Book Risk" />

  const run = x.run
  const sizing = x.positionSizing
  const st = statusOf(sizing)
  const holdings = Object.keys(x.positionSnapshot.weights ?? {}).length
  const reasons: Reason[] = [
    {
      tone: 'info',
      text: uiTemplate("The reported book of {0} holdings has {1} effective risk bets and {2} annualized volatility over {3} bars. The server publishes no good or bad grade for these.", [holdings, fn(x.current.effectiveRiskBets), up(x.current.annualizedVolatility, 2), n0(x.current.lookbackBars)]),
      field: 'current.effectiveRiskBets, current.annualizedVolatility',
    },
    sizing && sizing.status !== 'not-requested'
      ? {
          tone: sizing.result?.ceilingSatisfied ? 'info' : 'bad',
          text: uiTemplate("Caller-bounded sizing: {0}. The {1} volatility ceiling is {2}.", [words(sizing.resultMeaning), up(sizing.policy?.annualizedVolatilityCeiling, 2), sizing.result?.ceilingSatisfied ? 'satisfied' : 'not reachable within the weight bound']),
          field: `positionSizing.status = ${sizing.status}`,
        }
      : { tone: 'info', text: uiText("No caller-bounded sizing was requested, so the Run has no pass or fail question to answer."), field: 'positionSizing.status = not-requested' },
    {
      tone: 'info',
      text: uiTemplate("Position truth is {0}; trading authority is {1}. Reductions are {2}.", [words(x.authority?.positionTruth ?? x.positionSnapshot.authority?.positionTruth), x.authority?.tradingAuthority ?? x.positionSnapshot.authority?.tradingAuthority ?? '—', words(x.authority?.reductionMeaning)]),
      field: 'authority.positionTruth, authority.tradingAuthority',
    },
  ]

  const eq = x.equityPath
  const eqPts = (eq?.points ?? []).filter((p) => p.timestamp)
  const navSeries: ChartSeries[] = [
    { key: 'nav', label: uiText("NAV"), points: eqPts.map((p) => ({ x: Date.parse(p.timestamp), xl: day(p.timestamp), y: p.nav })) },
    { key: 'peak', label: uiText("Running peak"), tone: 'muted', points: eqPts.map((p) => ({ x: Date.parse(p.timestamp), xl: day(p.timestamp), y: p.runningPeak })) },
  ]
  const ddSeries: ChartSeries[] = [{ key: 'dd', label: uiText("Drawdown"), points: eqPts.map((p) => ({ x: Date.parse(p.timestamp), xl: day(p.timestamp), y: p.drawdown })) }]
  const roll = x.rollingPath
  const rollPts = (roll?.points ?? []).filter((p) => p.timestamp)
  const rx = (p: { timestamp: string }) => ({ x: Date.parse(p.timestamp), xl: day(p.timestamp) })
  const rs = roll?.summary

  const headText = `${holdings} holdings carry ${fn(x.current.effectiveRiskBets)} effective risk bets and ${up(x.current.annualizedVolatility, 2)} annualized volatility over ${n0(x.current.lookbackBars)} bars${
    sizing && sizing.status !== 'not-requested' ? `; sizing ceiling ${sizing.result?.ceilingSatisfied ? 'satisfied' : 'not reachable within the weight bound'}` : '; no sizing question was asked'
  }`

  return (
    <div className="pg">
      <LaneHead
        title={uiText("Book Risk")}
        projectId={project.id}
        projectName={project.name}
        lines={[
          <>{uiText("Run ")}<span className="mono">{run?.id?.replace(/^run-/, '') ?? '—'}</span> · {holdings}{uiText(" reported holdings as of ")}{day(x.positionSnapshot.asOf)} · {n0(x.current.lookbackBars)}{uiText("-bar window")}</>,
          'Descriptive audit of an externally reported book; no trading authority.',
          'This lane has no train, validation or test split: every number comes from the content-locked closed OHLCV history, so no test number exists to hide.',
        ]}
      />

      <SectionNav
        items={[
          { id: 'br-summary', label: uiText("Status and metrics") },
          { id: 'br-table', label: uiText("Contribution table") },
          { id: 'br-reduce', label: uiText("Reductions") },
          { id: 'br-windows', label: uiText("Windows") },
          { id: 'br-corr', label: uiText("Correlation") },
          { id: 'br-scen', label: uiText("Scenarios") },
          { id: 'br-sizing', label: uiText("Sizing") },
          { id: 'br-path', label: uiText("Path") },
          { id: 'br-audit', label: uiText("Authority") },
        ]}
      />

      <div className="hero-stack">
        <HeroLine
          tone={st.signal ? 'bad' : sizing && sizing.status !== 'not-requested' ? 'ok' : 'warn'}
          word={st.word}
          why={
            <Info label={uiText("Why this status")}>
              <p>{uiText("Read from the server&apos;s sizing status only. Without a sizing question this lane is a description, never a pass or fail.")}</p>
              <p className="faint mono">{uiText("positionSizing.status = ")}{sizing?.status ?? uiText("not-requested")}</p>
            </Info>
          }
        >
          {headText}
        </HeroLine>

        <section aria-labelledby="br-contrib">
          <div className="lane-hero-head">
            <h2 id="br-contrib">{uiText("Risk contributions")}</h2>
          </div>
          <Contributions x={x} part="bars" />
        </section>

        <HeroTiles items={coreTiles(x)} label={uiText("Core numbers")} />
      </div>

      <div className="band">
        <Section title={uiText("Status and metrics")} id="br-summary" caption={uiTemplate("{0} holdings, {1} cash, {2}.", [holdings, up(x.positionSnapshot.cashWeight, 1), x.positionSnapshot.baseCurrency ?? '—'])}>
          <div className="vstack">
            <StatusBand
              id="br-status-word"
              kicker="Server status · sizing question"
              word={st.word}
              glyph={st.glyph}
              signal={st.signal}
              lead="Read from the server's sizing status only. Without a sizing question this lane is a description, never a pass or fail."
              reasons={reasons}
            />
            <details className="pf-allmetrics">
              <summary>{uiText("All metrics")}</summary>
              <Tiles x={x} />
            </details>
          </div>
        </Section>
      </div>

      <Section title={uiText("Contribution table")} id="br-table" fold caption={uiText("Weight, absolute and signed risk share, component variance.")}>
        <Contributions x={x} part="table" />
      </Section>

      <Section title={uiText("Reduction priority")} id="br-reduce" caption={uiText("Standardized 1% cash-funded reductions, ranked.")}>
        <Reductions x={x} />
      </Section>

      <Section title={uiText("Lookback windows")} id="br-windows" caption={uiText("The same audit under each published window; the primary window is marked.")}>
        <Windows x={x} />
      </Section>

      <Section title={uiText("Correlation")} id="br-corr" caption={uiText("Return correlation between holdings over the primary window.")}>
        <Correlations x={x} />
      </Section>

      <Section title={uiText("Caller-supplied scenarios")} id="br-scen" caption={uiText("Caller-named hypothetical books; nothing is optimized.")}>
        <Scenarios x={x} />
      </Section>

      <Section title={uiText("Caller-bounded sizing")} id="br-sizing" caption={uiText("One asset against cash under a fixed volatility ceiling.")}>
        <SizingBlock sizing={sizing} />
      </Section>

      <Section title={uiText("Path of the constant-weight book")} id="br-path" caption={uiText("Constant-weight research path, then rolling risk.")}>
        <div className="vstack">
          {eq?.available === false || eqPts.length < 2 ? (
            <NaBox why={eq?.available === false ? 'the Run publishes no equity path' : `the Run publishes ${eqPts.length} equity points, too few to draw a path`} />
          ) : (
            <>
              <LaneChart
                title={uiText("Net asset value of the constant-weight book")}
                desc={uiTemplate("Starts at {0} and applies the reported weights to each same-clock close-to-close return.{1}", [fn(x.drawdown?.initialNav, 1), finite(eq?.totalRows) && finite(eq?.sampledRows) ? ` Sampled path: ${eq?.sampledRows} of ${eq?.totalRows} rows.` : ''])}
                series={navSeries}
                fy={(v) => fn(v, 3)}
                yLabel="NAV"
              />
              <LaneChart title={uiText("Drawdown from the running peak")} desc={uiText("Percent below the previous high of the same path.")} series={ddSeries} fy={(v) => sp(v, 1)} yLabel="drawdown" fill />
            </>
          )}
          <Block title={uiText("Drawdown facts")}>
            <DrawdownFacts d={x.drawdown ?? eq?.summary} />
          </Block>
          {rollPts.length < 2 ? (
            <NaBox why={`the rolling path has ${rollPts.length} windows, too few to draw`} />
          ) : (
            <>
              <LaneChart
                title={uiText("Rolling effective risk bets")}
                desc={uiTemplate("{0} rolling windows from {1} to {2}. Minimum {3}.", [rs?.observations ?? rollPts.length, day(rs?.start), day(rs?.end), fn(rs?.minimumEffectiveRiskBets)])}
                series={[{ key: 'bets', label: uiText("Effective bets"), points: rollPts.map((p) => ({ ...rx(p), y: p.effectiveRiskBets })) }]}
                fy={(v) => fn(v, 2)}
                yLabel="effective bets"
              />
              <LaneChart
                title={uiText("Rolling annualized volatility and first principal component")}
                desc={uiTemplate("Maximum component-risk HHI over the windows: {0}.", [fn(rs?.maximumComponentRiskHhi, 3)])}
                series={[
                  { key: 'vol', label: uiText("Volatility"), points: rollPts.map((p) => ({ ...rx(p), y: p.annualizedVolatility })) },
                  { key: 'pc1', label: uiText("First PC share"), points: rollPts.map((p) => ({ ...rx(p), y: p.firstPrincipalComponentVarianceShare })) },
                ]}
                fy={(v) => up(v, 1)}
                yLabel="share or volatility"
              />
            </>
          )}
        </div>
      </Section>

      <Section title={uiText("Authority and reported book")} id="br-audit" fold caption={uiText("Snapshot, what each number means, and the Run artifacts.")}>
        <div className="vstack">
          <Block title={uiText("Reported book")}>
            <WeightsTable weights={x.positionSnapshot.weights} cash={x.positionSnapshot.cashWeight} currency={x.positionSnapshot.baseCurrency} />
          </Block>
          <Block title={uiText("What the numbers mean")}>
            <Kv rows={Object.entries(x.authority ?? {}).map(([k, v]) => [k, words(v)] as [string, string])} />
          </Block>
          <Block title={uiText("Artifacts")}>
            <ArtifactList artifacts={x.artifacts} />
          </Block>
        </div>
      </Section>
    </div>
  )
}
