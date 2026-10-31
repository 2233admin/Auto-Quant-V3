import type { ReactNode } from 'react'
import type { FactorDiagnostics, FactorFold, FactorSplit, RankSummary, RunRow, SelectionIntegrity } from '../api'
import { Glyph } from '../design/icons'
import { num, plural, when } from '../format'
import { SPLIT_LABEL, SPLITS } from './factorMath'
import { Empty } from './FactorCharts'

const int = (v: number) => v.toLocaleString('en-US')
const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '—')
const finite = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v)
const sign = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '0')

/** The test split is drawn only when the Run publishes its visible audit; until then no test number appears. */
export const visibleSplits = (study: FactorDiagnostics): FactorSplit[] => (study.summary.testAudit ? SPLITS : SPLITS.filter((s) => s !== 'test'))

// ---------------------------------------------------------------------------------------------
// Verdict strip

export type Verdict = 'pass' | 'fail' | 'inconclusive'
type Reason = { tone: 'good' | 'bad' | 'info'; text: ReactNode; field: string }

/** diagnosis.stage values that mean "no edge found". Every other unqualified stage means "evidence not yet sufficient". */
const FAIL_STAGES = new Set(['raw-predictive-edge-absent', 'style-neutral-edge-absent', 'blend-uplift-absent', 'known-style-identity-mismatch'])

type Adjustment = SelectionIntegrity['selectionAdjustment']

/**
 * Reads the server's own qualification verdict and lines up the numbers beside it.
 * Verdict label: `factorQualification.diagnosis.qualifiesForPortfolio` (boolean) and `.stage` (enum), demoted to
 * inconclusive when the Session ledger says `selectionAdjustment.passes === false`. Nothing else is derived;
 * the reasons only quote published values and compare them with published thresholds.
 */
export function buildVerdict(study: FactorDiagnostics, adjustment: Adjustment | undefined): { verdict: Verdict; reasons: Reason[] } {
  const q = study.factorQualification
  const diagnosis = q.diagnosis
  const familywiseFailed = adjustment?.passes === false
  let verdict: Verdict
  if (!diagnosis) verdict = 'inconclusive'
  else if (diagnosis.qualifiesForPortfolio) verdict = familywiseFailed ? 'inconclusive' : 'pass'
  else verdict = FAIL_STAGES.has(diagnosis.stage) ? 'fail' : 'inconclusive'

  const reasons: Reason[] = []
  if (diagnosis) {
    reasons.push({
      tone: diagnosis.qualifiesForPortfolio ? 'good' : 'bad',
      text: <>{diagnosis.explanation}</>,
      field: `factorQualification.diagnosis.stage = ${diagnosis.stage}`,
    })
  } else {
    reasons.push({ tone: 'info', text: 'This Run publishes no Factor qualification, so there is no server verdict.', field: 'factorQualification.diagnosis' })
  }

  const validation = study.summary.validation
  const line = q.semantics?.diagnosticThresholds?.minimumPositiveHacTStatistic
  if (validation) {
    const t = validation.hacTStatistic
    if (!finite(t)) {
      reasons.push({ tone: 'info', text: 'Validation HAC t statistic is not defined (degenerate variance).', field: 'summary.validation.hacTStatistic' })
    } else if (finite(line)) {
      const clears = t >= line && (validation.meanRankIc ?? 0) > 0
      reasons.push({
        tone: clears ? 'good' : 'bad',
        text: clears
          ? `Validation HAC t ${num(t, 2)} is at or above the ${num(line, 2)} pass line.`
          : `Validation HAC t ${num(t, 2)} is below the ${num(line, 2)} pass line${(validation.meanRankIc ?? 0) <= 0 ? ' and the mean rank IC is not positive' : ''}.`,
        field: 'summary.validation.hacTStatistic vs diagnosticThresholds.minimumPositiveHacTStatistic',
      })
    } else {
      reasons.push({ tone: 'info', text: `Validation HAC t ${num(t, 2)}; the Run publishes no pass line.`, field: 'summary.validation.hacTStatistic' })
    }
    if (!validation.sufficient) {
      reasons.push({ tone: 'bad', text: `Validation has ${int(validation.observations)} observations, below the minimum ${int(validation.minimumObservations)}.`, field: 'summary.validation.sufficient' })
    }
    if (finite(validation.meanRankIc) && finite(validation.meanPearsonIc) && Math.sign(validation.meanRankIc) !== Math.sign(validation.meanPearsonIc)) {
      reasons.push({
        tone: 'bad',
        text: `Validation mean IC (Pearson ${num(validation.meanPearsonIc, 4)}) and mean rank IC (${num(validation.meanRankIc, 4)}) disagree in sign.`,
        field: 'summary.validation.meanPearsonIc vs meanRankIc',
      })
    }
  }

  const primary = study.horizonProfile.find((row) => row.horizon === study.protocol.primaryHorizon)
  if (primary) {
    const shown = visibleSplits(study).filter((s) => finite(primary[s].meanRankIc))
    const signs = new Set(shown.map((s) => Math.sign(primary[s].meanRankIc as number)))
    if (shown.length > 1) {
      const listing = shown.map((s) => `${SPLIT_LABEL[s].toLowerCase()} ${sign(primary[s].meanRankIc as number)}${num(Math.abs(primary[s].meanRankIc as number), 4)}`).join(', ')
      reasons.push({
        tone: signs.size > 1 ? 'bad' : 'good',
        text: signs.size > 1 ? `Mean rank IC changes sign across splits: ${listing}.` : `Mean rank IC has the same sign in every shown split: ${listing}.`,
        field: `horizonProfile[${primary.horizon}].{split}.meanRankIc`,
      })
    }
  }

  const folds = (study.stability?.chronologicalFolds ?? []).filter((f) => f.split === 'validation')
  if (folds.length > 0) {
    const positive = folds.filter((f) => finite(f.meanRankIc) && f.meanRankIc > 0).length
    reasons.push({
      tone: positive === folds.length ? 'good' : 'bad',
      text: `${positive} of ${plural(folds.length, 'chronological validation fold')} ${positive === 1 ? 'has' : 'have'} a positive mean rank IC.`,
      field: 'stability.chronologicalFolds[validation].meanRankIc',
    })
  }

  if (adjustment) {
    const stats = adjustment.statistics
    if (adjustment.passes === true) {
      reasons.push({ tone: 'good', text: `The family-wise rule is met${stats ? ` (adjusted p ${num(stats.familywiseAdjustedPValue, 3)} over ${plural(stats.uniqueTrials, 'trial')})` : ''}.`, field: 'selectionAdjustment.passes = true' })
    } else if (adjustment.passes === false) {
      reasons.push({
        tone: 'bad',
        text: `The family-wise rule is not met${stats ? ` (adjusted p ${num(stats.familywiseAdjustedPValue, 3)} over ${plural(stats.uniqueTrials, 'trial')}; the rule needs ≤ ${num(1 - adjustment.confidenceLevel, 2)})` : ''}.`,
        field: 'selectionAdjustment.passes = false',
      })
    } else {
      reasons.push({ tone: 'info', text: `The family-wise rule has no verdict: ${adjustment.interpretation}`, field: 'selectionAdjustment.passes = null' })
    }
  } else {
    reasons.push({ tone: 'info', text: 'No Session ledger records the trials, so the family-wise rule cannot be applied.', field: 'selectionIntegrity.selectionAdjustment' })
  }
  return { verdict, reasons }
}

const VERDICT_WORD: Record<Verdict, string> = { pass: 'Pass', fail: 'Fail', inconclusive: 'Inconclusive' }
const VERDICT_GLYPH = { pass: 'supported', fail: 'refuted', inconclusive: 'inconclusive' } as const

export function VerdictStrip({ study, adjustment }: { study: FactorDiagnostics; adjustment: Adjustment | undefined }) {
  const { verdict, reasons } = buildVerdict(study, adjustment)
  const diagnosis = study.factorQualification.diagnosis
  return (
    <section className={`verdict verdict--${verdict}`} aria-labelledby="verdict-word">
      <div className="verdict-main">
        <p className="verdict-kicker">Verdict · validation split</p>
        <h2 id="verdict-word" className="verdict-word">
          <Glyph kind={VERDICT_GLYPH[verdict]} signal={verdict === 'fail'} />
          <span>{VERDICT_WORD[verdict]}</span>
        </h2>
        <p className="muted small">
          {diagnosis ? (
            <>
              Stage <span className="mono">{diagnosis.stage}</span>
              {diagnosis.iterationFocus && (
                <>
                  ; next focus <span className="mono">{diagnosis.iterationFocus}</span>
                </>
              )}
              .
            </>
          ) : (
            'No qualification stage.'
          )}{' '}
          Label read from the server stage and its qualifies-for-portfolio flag; the family-wise flag can only demote a pass.
        </p>
      </div>
      <ul className="verdict-reasons">
        {reasons.map((r, i) => (
          <li key={i}>
            <Glyph kind={r.tone === 'good' ? 'supported' : r.tone === 'bad' ? 'error' : 'empty'} signal={r.tone === 'bad'} />
            <span>
              {r.text}
              <span className="faint small mono verdict-field">{r.field}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ---------------------------------------------------------------------------------------------
// Tables

function foldOrder(a: { split: FactorSplit; id?: string }, b: { split: FactorSplit; id?: string }) {
  const bySplit = SPLITS.indexOf(a.split) - SPLITS.indexOf(b.split)
  return bySplit !== 0 ? bySplit : (a.id ?? '').localeCompare(b.id ?? '', 'en', { numeric: true })
}

const T = ({ v, d = 2 }: { v: number | null | undefined; d?: number }) => <>{num(v, d)}</>

function SplitCell({ split, role }: { split: FactorSplit; role: string }) {
  return (
    <>
      {SPLIT_LABEL[split]}
      <span className="faint small"> · {role}</span>
    </>
  )
}

export function FoldTable({ study }: { study: FactorDiagnostics }) {
  const shown = visibleSplits(study)
  const folds = (study.stability?.chronologicalFolds ?? []).filter((f) => shown.includes(f.split)).sort(foldOrder)
  if (folds.length === 0) return <Empty title="Chronological folds" reason="This Run publishes no chronological folds." />
  return (
    <div className="tablewrap">
      <table className="tbl">
        <caption className="faint small">Each split cut into consecutive halves in time order. The weakest validation fold is {study.summary.weakestValidationFold?.id ?? 'not recorded'}.</caption>
        <thead>
          <tr>
            <th scope="col">Fold</th>
            <th scope="col">Split</th>
            <th scope="col" className="r">Observations</th>
            <th scope="col" className="r">Mean rank IC</th>
            <th scope="col" className="r">IC IR</th>
            <th scope="col" className="r">Hit rate</th>
            <th scope="col" className="r">HAC t</th>
            <th scope="col" className="r">HAC p</th>
          </tr>
        </thead>
        <tbody>
          {folds.map((f: FactorFold) => (
            <tr key={f.id}>
              <th scope="row" className="mono">
                {f.id}
                {study.summary.weakestValidationFold?.id === f.id && <span className="sig small">weakest</span>}
              </th>
              <td>
                <SplitCell split={f.split} role={f.role} />
              </td>
              <td className="r mono">
                {int(f.observations)}
                {!f.sufficient && <span className="sig"> *</span>}
              </td>
              <td className="r mono"><T v={f.meanRankIc} d={4} /></td>
              <td className="r mono"><T v={f.rankIcir} d={3} /></td>
              <td className="r mono"><T v={f.rankHitRate} d={3} /></td>
              <td className="r mono"><T v={f.hacTStatistic} /></td>
              <td className="r mono"><T v={f.hacNormalPValue} d={3} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const VARIANTS = [
  ['candidate', 'Candidate'],
  ['dominantStyle', 'Dominant style'],
  ['styleNeutralCandidate', 'Candidate without that style'],
  ['equalRankBlend', 'Equal-rank blend'],
] as const

const INCREMENTAL: [string, string][] = [
  ['styleNeutralIcRetention', 'Share of candidate IC kept after removing the style'],
  ['styleNeutralIcDelta', 'Style-neutral IC minus candidate IC'],
  ['blendUpliftVsStyle', 'Blend IC minus style IC'],
  ['blendUpliftVsCandidate', 'Blend IC minus candidate IC'],
]

export function QualificationBlock({ study }: { study: FactorDiagnostics }) {
  const q = study.factorQualification
  if (!q.available || !q.diagnosis) return <Empty title="Qualification diagnosis" reason="This Run has no Factor qualification." />
  const line = q.semantics?.diagnosticThresholds?.minimumPositiveHacTStatistic
  const parts: [FactorSplit, typeof q.validation][] = [['validation', q.validation]]
  if (study.summary.testAudit) parts.push(['test', q.testAudit])
  const d = q.diagnosis
  return (
    <>
      <dl className="kv">
        <dt>Stage</dt>
        <dd className="mono">{d.stage}</dd>
        <dt>Next focus</dt>
        <dd className="mono">{d.iterationFocus ?? '—'}</dd>
        <dt>Qualifies for Portfolio</dt>
        <dd>
          <span className="state">
            <Glyph kind={d.qualifiesForPortfolio ? 'supported' : 'error'} signal={!d.qualifiesForPortfolio} />
            {d.qualifiesForPortfolio ? 'Yes' : <span className="sig">No</span>}
          </span>
        </dd>
        <dt>Claim</dt>
        <dd>
          <span className="mono">{q.claim?.claim ?? '—'}</span>
          {q.claim?.outcome && (
            <>
              {' '}
              on <span className="mono">{q.claim.outcome}</span>
            </>
          )}
        </dd>
        <dt>Why</dt>
        <dd>{d.explanation}</dd>
      </dl>
      <div className="tablewrap">
        <table className="tbl">
          <caption className="faint small">
            Each variant against the HAC t line{finite(line) ? ` ${num(line, 2)}` : ''} the server publishes. The funnel stops at the first variant that fails; later rows are context.
            {q.selection?.dominantStyle && (
              <>
                {' '}
                The dominant style, chosen on train only, is <span className="mono">{q.selection.dominantStyle}</span>.
              </>
            )}
          </caption>
          <thead>
            <tr>
              <th scope="col">Variant</th>
              <th scope="col">Split</th>
              <th scope="col" className="r">Mean rank IC</th>
              <th scope="col" className="r">HAC t</th>
              <th scope="col" className="r">HAC p</th>
              <th scope="col">Against the line</th>
            </tr>
          </thead>
          <tbody>
            {parts.flatMap(([split, part]) =>
              part
                ? VARIANTS.map(([key, label]) => {
                    const s: RankSummary = part[key]
                    const clears = split === 'validation' && finite(line) && finite(s.hacTStatistic) && finite(s.meanRankIc) ? s.meanRankIc > 0 && s.hacTStatistic >= line : null
                    return (
                      <tr key={`${split}-${key}`}>
                        <th scope="row">{label}</th>
                        <td>
                          <SplitCell split={split} role={part.role} />
                        </td>
                        <td className="r mono"><T v={s.meanRankIc} d={4} /></td>
                        <td className="r mono"><T v={s.hacTStatistic} /></td>
                        <td className="r mono"><T v={s.hacNormalPValue} d={3} /></td>
                        <td>
                          {clears === null ? (
                            <span className="faint">—</span>
                          ) : (
                            <span className="state">
                              <Glyph kind={clears ? 'supported' : 'error'} signal={!clears} />
                              <span className={clears ? undefined : 'sig'}>{clears ? 'Clears' : 'Below'}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                : [],
            )}
          </tbody>
        </table>
      </div>
      {q.validation && (
        <dl className="kv">
          {INCREMENTAL.map(([key, label]) => (
            <div key={key} className="kv-row">
              <dt>{label}</dt>
              <dd className="mono">{num(q.validation?.incremental[key], 4)}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  )
}

export function HorizonTable({ study }: { study: FactorDiagnostics }) {
  const shown = visibleSplits(study)
  if (study.horizonProfile.length === 0) return <Empty title="Horizon profile" reason="This Run publishes no horizon profile." />
  return (
    <div className="tablewrap">
      <table className="tbl">
        <caption className="faint small">Candidate rank IC at each forward horizon. Selection reads only the {study.protocol.primaryHorizon}-bar horizon; the others are context.</caption>
        <thead>
          <tr>
            <th scope="col">Horizon</th>
            <th scope="col">Split</th>
            <th scope="col" className="r">Observations</th>
            <th scope="col" className="r">Mean rank IC</th>
            <th scope="col" className="r">Mean Pearson IC</th>
            <th scope="col" className="r">HAC t</th>
            <th scope="col" className="r">HAC p</th>
          </tr>
        </thead>
        <tbody>
          {study.horizonProfile.flatMap((row) =>
            shown.map((split) => {
              const s = row[split]
              return (
                <tr key={`${row.horizon}-${split}`}>
                  <th scope="row">
                    {row.horizon}-bar
                    {row.horizon === study.protocol.primaryHorizon && <span className="faint small">primary</span>}
                  </th>
                  <td>
                    <SplitCell split={split} role={s.role} />
                  </td>
                  <td className="r mono">
                    {int(s.observations)}
                    {!s.sufficient && <span className="sig"> *</span>}
                  </td>
                  <td className="r mono"><T v={s.meanRankIc} d={4} /></td>
                  <td className="r mono"><T v={s.meanPearsonIc} d={4} /></td>
                  <td className="r mono"><T v={s.hacTStatistic} /></td>
                  <td className="r mono"><T v={s.hacNormalPValue} d={3} /></td>
                </tr>
              )
            }),
          )}
        </tbody>
      </table>
    </div>
  )
}

export function StabilityTables({ study }: { study: FactorDiagnostics }) {
  const stability = study.stability
  if (!stability) return <Empty title="Stability" reason="This server does not send regime, asset and style stability." />
  const shown = visibleSplits(study)
  const regimes = stability.causalRegimes.filter((r) => shown.includes(r.split)).sort((a, b) => foldOrder({ split: a.split, id: a.regime }, { split: b.split, id: b.regime }))
  const assets = stability.assets.filter((r) => shown.includes(r.split)).sort((a, b) => foldOrder({ split: a.split, id: a.asset }, { split: b.split, id: b.asset }))
  const styles = stability.styles.filter((r) => shown.includes(r.split)).sort((a, b) => foldOrder({ split: a.split, id: a.style }, { split: b.split, id: b.style }))
  return (
    <div className="stack">
      <div>
        <h3 className="h-small">By market regime</h3>
        <p className="muted small">{study.protocol.semantics.regimes ?? 'Causal trailing market direction and volatility.'}</p>
        <div className="tablewrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Regime</th>
                <th scope="col">Split</th>
                <th scope="col" className="r">Observations</th>
                <th scope="col" className="r">Mean rank IC</th>
                <th scope="col" className="r">HAC t</th>
                <th scope="col" className="r">HAC p</th>
              </tr>
            </thead>
            <tbody>
              {regimes.map((r) => (
                <tr key={`${r.split}-${r.regime}`}>
                  <th scope="row" className="mono">{r.regime}</th>
                  <td>
                    <SplitCell split={r.split} role={r.role} />
                  </td>
                  <td className="r mono">
                    {int(r.observations)}
                    {!r.sufficient && <span className="sig"> *</span>}
                  </td>
                  <td className="r mono"><T v={r.meanRankIc} d={4} /></td>
                  <td className="r mono"><T v={r.hacTStatistic} /></td>
                  <td className="r mono"><T v={r.hacNormalPValue} d={3} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <h3 className="h-small">By asset</h3>
        <div className="tablewrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Asset</th>
                <th scope="col">Split</th>
                <th scope="col" className="r">Observations</th>
                <th scope="col" className="r">Rank correlation</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((r) => (
                <tr key={`${r.split}-${r.asset}`}>
                  <th scope="row" className="mono" translate="no">{r.asset}</th>
                  <td>
                    <SplitCell split={r.split} role={r.role} />
                  </td>
                  <td className="r mono">{int(r.observations)}</td>
                  <td className="r mono"><T v={r.rankCorrelation} d={4} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <h3 className="h-small">Overlap with known styles</h3>
        <div className="tablewrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Style</th>
                <th scope="col">Split</th>
                <th scope="col" className="r">Observations</th>
                <th scope="col" className="r">Mean rank correlation</th>
                <th scope="col" className="r">Mean |rank correlation|</th>
              </tr>
            </thead>
            <tbody>
              {styles.map((r) => (
                <tr key={`${r.split}-${r.style}`}>
                  <th scope="row" className="mono">{r.style}</th>
                  <td>
                    <SplitCell split={r.split} role={r.role} />
                  </td>
                  <td className="r mono">{int(r.observations)}</td>
                  <td className="r mono"><T v={r.meanRankCorrelation} d={3} /></td>
                  <td className="r mono"><T v={r.meanAbsoluteRankCorrelation} d={3} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Boxes

const Hash = ({ value }: { value: string | undefined }) =>
  value ? <span className="mono hash" translate="no">{value}</span> : <span className="faint">not recorded</span>

export function ProvenanceBox({ study, row }: { study: FactorDiagnostics; row: RunRow | undefined }) {
  const h = study.harness
  const duration = row?.durationMs
  return (
    <dl className="kv box">
      <dt>Run</dt>
      <dd className="mono" translate="no">{study.run.id}</dd>
      <dt>Study</dt>
      <dd className="mono" translate="no">{study.run.studyId}</dd>
      <dt>Started / completed (UTC)</dt>
      <dd>
        {when(study.run.startedAt)} / {when(study.run.completedAt)}
        {typeof duration === 'number' && <span className="faint"> · {(duration / 1000).toFixed(1)} s</span>}
      </dd>
      <dt>Input hash</dt>
      <dd><Hash value={study.run.inputHash} /></dd>
      <dt>Study hash</dt>
      <dd><Hash value={study.run.studyHash} /></dd>
      <dt>Candidate source hash</dt>
      <dd><Hash value={study.run.sourceHash} /></dd>
      <dt>Dataset</dt>
      <dd>
        <span className="mono" translate="no">{study.dataset.id}</span>, version <span className="mono" translate="no">{study.dataset.version}</span>, {day(study.dataset.timeRange?.start)} to{' '}
        {day(study.dataset.timeRange?.end)}, {plural(study.dataset.universe.length, 'asset')}
      </dd>
      <dt>Dataset hash</dt>
      <dd><Hash value={study.dataset.hash} /></dd>
      <dt>Harness</dt>
      <dd>
        {h ? (
          <>
            <span className="mono" translate="no">{h.id}</span> {h.version} · Python {h.python ?? '—'} · {h.buildProvenance ?? 'unknown build'}
          </>
        ) : (
          <span className="faint">not recorded</span>
        )}
      </dd>
      <dt>Harness commit</dt>
      <dd>
        <Hash value={h?.commit} />
        {h?.dirty !== undefined && <span className={h.dirty ? 'sig' : 'faint'}> · {h.dirty ? 'dirty working tree' : 'clean'}</span>}
      </dd>
      <dt>Harness source hash</dt>
      <dd><Hash value={h?.sourceHash} /></dd>
    </dl>
  )
}

export function ProtocolBox({ study }: { study: FactorDiagnostics }) {
  const p = study.protocol
  const w = p.splits.splits
  const horizon = study.researchHorizon
  const c = p.causality
  return (
    <div className="stack">
      <dl className="kv box">
        <dt>Causality</dt>
        <dd>
          {c?.available ? (
            <>
              <span className="state"><Glyph kind="supported" />Audited</span>, <span className="mono">{c.audit}</span> at {plural(c.cuts?.length ?? 0, 'cut')}; cross-asset context{' '}
              <span className="mono">{c.crossAssetContext ?? 'not recorded'}</span>
            </>
          ) : c ? (
            <>Not recorded: {c.reason}</>
          ) : (
            <span className="faint">This server does not send the causality audit.</span>
          )}
        </dd>
        <dt>Split</dt>
        <dd>
          <span className="mono">{p.splits.method}</span>; candidate dependent: {p.splits.candidateDependent ? 'yes' : 'no'}; target crosses a boundary: {p.splits.targetCrossesBoundary ? 'yes' : 'no'}
        </dd>
        <dt>Selection</dt>
        <dd>
          on <span className="mono">{p.selectionSplit}</span>; test is <span className="mono">{p.testRole}</span>, enters selection: {p.testEntersSelection ? 'yes' : 'no'}
        </dd>
        <dt>Horizon policy</dt>
        <dd>
          {horizon ? (
            <>
              <span className="mono">{horizon.source.horizonPolicy}</span>: {horizon.source.horizon}. Selection reads <span className="mono">{horizon.selectionAuthority.primary}</span> at the{' '}
              {horizon.primaryForwardBars}-bar horizon; the {horizon.diagnosticForwardBars.filter((b) => b !== horizon.primaryForwardBars).join(' and ')}-bar horizons are{' '}
              <span className="mono">{horizon.selectionAuthority.diagnostics}</span>. Target: <span className="mono">{horizon.targetSemantics}</span>.
            </>
          ) : (
            <>
              Primary {p.primaryHorizon}-bar; horizons {p.horizons.join(', ')}.
            </>
          )}
        </dd>
      </dl>
      <div className="tablewrap">
        <table className="tbl">
          <caption className="faint small">Split windows, fixed from the dataset before any candidate ran. Rows purged at the boundary keep forward targets from crossing it.</caption>
          <thead>
            <tr>
              <th scope="col">Split</th>
              <th scope="col">From</th>
              <th scope="col">To</th>
              <th scope="col" className="r">Rows</th>
              {Object.keys(p.splits.horizons).map((h) => (
                <th scope="col" className="r" key={h}>Purged, {h}-bar</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SPLITS.map((s) => (
              <tr key={s}>
                <th scope="row">
                  <span><SplitCell split={s} role={w[s].role} /></span>
                </th>
                <td className="mono">{day(w[s].start)}</td>
                <td className="mono">{day(w[s].end)}</td>
                <td className="r mono">{int(w[s].rows)}</td>
                {Object.entries(p.splits.horizons).map(([h, by]) => (
                  <td className="r mono" key={h}>{int(by[s].purgedBoundaryRows)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function errorText(e: unknown): string {
  if (typeof e === 'string') return e
  if (e && typeof e === 'object') {
    const o = e as Record<string, unknown>
    const message = typeof o.message === 'string' ? o.message : null
    const code = typeof o.code === 'string' ? o.code : null
    if (message) return code ? `${code}: ${message}` : message
    return JSON.stringify(e)
  }
  return String(e)
}

export function RunErrors({ row }: { row: RunRow | undefined }) {
  if (!row) return <p className="muted">The Project snapshot lists no row for this Run.</p>
  const errors = row.errors ?? []
  const bad = errors.length > 0 || row.status !== 'succeeded'
  return (
    <>
      <p className="small">
        <span className="state">
          <Glyph kind={bad ? 'error' : 'supported'} signal={bad} />
          <span className={bad ? 'sig' : undefined}>Status {row.status}</span>
        </span>
        {row.failureDisposition ? (
          <>
            {' · '}failure disposition <span className="mono">{row.failureDisposition}</span>
          </>
        ) : null}
        {' · '}
        {errors.length === 0 ? 'no errors recorded' : `${plural(errors.length, 'error')} recorded`}
      </p>
      {errors.length > 0 && (
        <ul className="bullets">
          {errors.map((e, i) => (
            <li key={i} className="mono small">{errorText(e)}</li>
          ))}
        </ul>
      )}
    </>
  )
}
