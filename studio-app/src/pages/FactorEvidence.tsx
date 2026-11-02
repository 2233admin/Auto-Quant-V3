import { translate, uiTemplate, uiText, uiValue, useLanguage } from '../i18n'
import type { ReactNode } from 'react'
import type { FactorDiagnostics, FactorFold, FactorSplit, RankSummary, RunRow, SelectionIntegrity } from '../api'
import { Glyph } from '../design/icons'
import { num, plural, when } from '../format'
import { SPLIT_LABEL, SPLITS } from './factorMath'
import { gatedSplits, studyTestVisible, TEST_HIDDEN_NOTE } from './testGate'
import { Empty } from './FactorCharts'
import { Info } from '../components/Info'
import { VerdictBar } from '../components/workbench'

const int = (v: number) => v.toLocaleString('en-US')
const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '—')
const finite = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v)
const sign = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '0')

/** The test split is drawn only when the Run publishes its visible audit; until then no test number appears. */
export const visibleSplits = (study: FactorDiagnostics): FactorSplit[] => gatedSplits(study, SPLITS)

// ---------------------------------------------------------------------------------------------
// Verdict strip

export type Verdict = 'pass' | 'fail' | 'inconclusive'
type Reason = { tone: 'good' | 'bad' | 'info'; text: ReactNode; field: string }

/** diagnosis.stage values that mean "no edge found". Every other unqualified stage means "evidence not yet sufficient". */
// A failed qualification is not a falsification of the caller's idea.
const FAIL_STAGES = new Set<string>()

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
      text: <>{uiValue(diagnosis.explanation)}</>,
      field: `factorQualification.diagnosis.stage = ${diagnosis.stage}`,
    })
  } else {
    reasons.push({ tone: 'info', text: uiText("This Run publishes no Factor qualification, so there is no server verdict."), field: 'factorQualification.diagnosis' })
  }

  const validation = study.summary.validation
  const line = q.semantics?.diagnosticThresholds?.minimumPositiveHacTStatistic
  if (validation) {
    const t = validation.hacTStatistic
    if (!finite(t)) {
      reasons.push({ tone: 'info', text: uiText("Validation HAC t statistic is not defined (degenerate variance)."), field: 'summary.validation.hacTStatistic' })
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
      reasons.push({ tone: 'info', text: uiTemplate("Validation HAC t {0}; the Run publishes no pass line.", [num(t, 2)]), field: 'summary.validation.hacTStatistic' })
    }
    if (!validation.sufficient) {
      reasons.push({ tone: 'bad', text: uiTemplate("Validation has {0} observations, below the minimum {1}.", [int(validation.observations), int(validation.minimumObservations)]), field: 'summary.validation.sufficient' })
    }
    if (finite(validation.meanRankIc) && finite(validation.meanPearsonIc) && Math.sign(validation.meanRankIc) !== Math.sign(validation.meanPearsonIc)) {
      reasons.push({
        tone: 'bad',
        text: uiTemplate("Validation mean IC (Pearson {0}) and mean rank IC ({1}) disagree in sign.", [num(validation.meanPearsonIc, 4), num(validation.meanRankIc, 4)]),
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
      text: uiTemplate("{0} of {1} {2} a positive mean rank IC.", [positive, plural(folds.length, 'chronological validation fold'), positive === 1 ? 'has' : 'have']),
      field: 'stability.chronologicalFolds[validation].meanRankIc',
    })
  }

  if (adjustment) {
    const stats = adjustment.statistics
    if (adjustment.passes === true) {
      reasons.push({ tone: 'good', text: uiTemplate("The family-wise rule is met{0}.", [stats ? ` (adjusted p ${num(stats.familywiseAdjustedPValue, 3)} over ${plural(stats.uniqueTrials, 'trial')})` : '']), field: 'selectionAdjustment.passes = true' })
    } else if (adjustment.passes === false) {
      reasons.push({
        tone: 'bad',
        text: uiTemplate("The family-wise rule is not met{0}.", [stats ? ` (adjusted p ${num(stats.familywiseAdjustedPValue, 3)} over ${plural(stats.uniqueTrials, 'trial')}; the rule needs ≤ ${num(1 - adjustment.confidenceLevel, 2)})` : '']),
        field: 'selectionAdjustment.passes = false',
      })
    } else {
      reasons.push({ tone: 'info', text: uiTemplate("The family-wise rule has no verdict: {0}", [adjustment.interpretation]), field: 'selectionAdjustment.passes = null' })
    }
  } else {
    reasons.push({ tone: 'info', text: uiText("No Session ledger records the trials, so the family-wise rule cannot be applied."), field: 'selectionIntegrity.selectionAdjustment' })
  }
  return { verdict, reasons }
}

const VERDICT_WORD: Record<Verdict, string> = { pass: 'Pass', fail: 'Fail', inconclusive: 'Inconclusive' }

const ic4 = (v: number) => `${v < 0 ? '-' : ''}${Math.abs(v).toFixed(4)}`

/**
 * One plain sentence, built only from the server's qualification stage verdict (via buildVerdict) and the
 * published validation numbers and pass line. No new statistic is computed.
 */
export function verdictSentence(study: FactorDiagnostics, adjustment: Adjustment | undefined, verdict: Verdict): string {
  const v = study.summary.validation
  const line = study.factorQualification.semantics?.diagnosticThresholds?.minimumPositiveHacTStatistic
  const lead = uiText(verdict === 'fail' ? 'Qualification not met' : verdict === 'pass' ? 'Qualifies on validation' : 'Not established')
  if (!v || !finite(v.meanRankIc)) {
    const d = study.factorQualification.diagnosis
    return `${lead}: ${d ? d.explanation : 'this Run publishes no validation summary and no server verdict.'}`
  }
  const dir = v.meanRankIc > 0 ? 'positive' : v.meanRankIc < 0 ? 'negative' : 'zero'
  const t = v.hacTStatistic
  const parts = [ic4(v.meanRankIc)]
  if (finite(t)) {
    parts.push(`HAC t ${num(t, 2)}`)
    if (finite(line)) parts.push(`${t >= line ? 'at or above' : 'below'} the ${num(line, 2)} line`)
  } else {
    parts.push('HAC t undefined')
  }
  let out = `${lead}: validation rank IC is ${dir} (${parts.join(', ')})`
  if (verdict === 'inconclusive' && adjustment?.passes === false) {
    const adj = adjustment.statistics?.familywiseAdjustedPValue
    out += `; the family-wise rule is not met${finite(adj) ? ` (adjusted p ${num(adj, 3)})` : ''}`
  }
  return `${out}.`
}

const ic3 = (v: number) => `${v < 0 ? '-' : '+'}${Math.abs(v).toFixed(3)}`

/**
 * The one-line form of the verdict, about 60 characters: the two numbers that decide it and the line they are held to
 * ("Not established: validation rank IC +0.077, HAC t 1.52 < 1.96"). The long explanation is `verdictSentence`.
 */
export function verdictClause(study: FactorDiagnostics, verdict: Verdict): string {
  const v = study.summary.validation
  const line = study.factorQualification.semantics?.diagnosticThresholds?.minimumPositiveHacTStatistic
  const lead = uiText(verdict === 'fail' ? 'Qualification not met' : verdict === 'pass' ? 'Qualifies' : 'Not established')
  if (!v || !finite(v.meanRankIc)) return uiTemplate("{0}: no validation summary published", [lead])
  const t = v.hacTStatistic
  const tPart = finite(t) ? `HAC t ${num(t, 2)}${finite(line) ? ` ${t >= line ? '≥' : '<'} ${num(line, 2)}` : ''}` : 'HAC t undefined'
  return uiTemplate("{0}: validation rank IC {1}, {2}", [lead, ic3(v.meanRankIc), tPart])
}

const TONE_RANK = { bad: 0, info: 1, good: 2 } as const

/** At most three bullets: the server's own explanation first, then failing reasons, then the rest. The full list lives in the Checks tab. */
export function topReasons(reasons: Reason[]): Reason[] {
  const [first, ...rest] = reasons
  const ranked = rest.filter((r) => !r.field.startsWith('summary.validation.hacTStatistic')).sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone])
  return [first, ...ranked].filter(Boolean).slice(0, 3)
}

function ReasonList({ reasons }: { reasons: Reason[] }) {
  return (
    <ul className="verdict-reasons">
      {reasons.map((r, i) => (
        <li key={i}>
          <Glyph kind={r.tone === 'good' ? 'supported' : r.tone === 'bad' ? 'error' : 'empty'} signal={r.tone === 'bad'} />
          <span>
            {uiValue(r.text)}{' '}
            <Info label={uiText("Why: the field behind this reason")}>
              <p className="mono verdict-field">{r.field}</p>
            </Info>
          </span>
        </li>
      ))}
    </ul>
  )
}

const KIT_TONE = { pass: 'ok', fail: 'bad', inconclusive: 'warn' } as const

/** The verdict as the kit's one-line bar: word, the first sentence, and "More" for the whole sentence and the top reasons. */
export function FactorVerdict({ study, adjustment }: { study: FactorDiagnostics; adjustment: Adjustment | undefined }) {
  const { verdict, reasons } = buildVerdict(study, adjustment)
  return (
    <VerdictBar tone={KIT_TONE[verdict]} word={VERDICT_WORD[verdict]} reasons={topReasons(reasons)} detail={verdictSentence(study, adjustment, verdict)}>
      {verdictClause(study, verdict)}
    </VerdictBar>
  )
}

/** Every reason with its field-name provenance, for the Checks tab. */
export function VerdictReasons({ study, adjustment }: { study: FactorDiagnostics; adjustment: Adjustment | undefined }) {
  return <ReasonList reasons={buildVerdict(study, adjustment).reasons} />
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
      <span className="faint small"> · {uiValue(role)}</span>
    </>
  )
}

export function FoldTable({ study }: { study: FactorDiagnostics }) {
  const language = useLanguage()
  const t = (en: string, zh: string) => translate(language, en, zh)
  const shown = visibleSplits(study)
  const folds = (study.stability?.chronologicalFolds ?? []).filter((f) => shown.includes(f.split)).sort(foldOrder)
  if (folds.length === 0) return <Empty title={t('Chronological folds', '时间分折')} reason={t('This Run publishes no chronological folds.', '本次运行没有发布时间分折。')} />
  return (
    <div className="tablewrap tablewrap--tall">
      {!studyTestVisible(study) && <p className="faint small">{TEST_HIDDEN_NOTE}</p>}
      <table className="tbl">
        <caption className="faint small">{t('Each split cut into consecutive halves in time order. The weakest validation fold is', '每个数据划分按时间顺序分为连续两半。最弱的验证分折为')} {study.summary.weakestValidationFold?.id ?? t('not recorded', '未记录')}.</caption>
        <thead>
          <tr>
            <th scope="col">{t('Fold', '分折')}</th>
            <th scope="col">{t('Split', '数据划分')}</th>
            <th scope="col" className="r">{t('Observations', '观测数')}</th>
            <th scope="col" className="r">{t('Mean rank IC', '平均秩 IC')}</th>
            <th scope="col" className="r">{uiText("IC IR")}</th>
            <th scope="col" className="r">{t('Hit rate', '命中率')}</th>
            <th scope="col" className="r">{uiText("HAC t")}</th>
            <th scope="col" className="r">{uiText("HAC p")}</th>
          </tr>
        </thead>
        <tbody>
          {folds.map((f: FactorFold) => (
            <tr key={f.id}>
              <th scope="row" className="mono">
                {f.id}
                {study.summary.weakestValidationFold?.id === f.id && <span className="sig small">{t('weakest', '最弱')}</span>}
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
  const language = useLanguage()
  const t = (en: string, zh: string) => translate(language, en, zh)
  const q = study.factorQualification
  if (!q.available || !q.diagnosis) return <Empty title={t('Qualification diagnosis', '资格诊断')} reason={t('This Run has no Factor qualification.', '本次运行没有因子资格结果。')} />
  const line = q.semantics?.diagnosticThresholds?.minimumPositiveHacTStatistic
  const parts: [FactorSplit, typeof q.validation][] = [['validation', q.validation]]
  if (studyTestVisible(study)) parts.push(['test', q.testAudit])
  const d = q.diagnosis
  return (
    <>
      <dl className="kv">
        <dt>{t('Stage', '阶段')}</dt>
        <dd className="mono">{uiValue(d.stage)}</dd>
        <dt>{t('Next focus', '下一步重点')}</dt>
        <dd className="mono">{d.iterationFocus ?? '—'}</dd>
        <dt>{t('Qualifies for Portfolio', '是否具备组合研究资格')}</dt>
        <dd>
          <span className="state">
            <Glyph kind={d.qualifiesForPortfolio ? 'supported' : 'error'} signal={!d.qualifiesForPortfolio} />
            {d.qualifiesForPortfolio ? t('Yes', '是') : <span className="sig">{t('No', '否')}</span>}
          </span>
        </dd>
        <dt>{t('Claim', '研究主张')}</dt>
        <dd>
          <span className="mono">{q.claim?.claim ?? '—'}</span>
          {q.claim?.outcome && (
            <>
              {' '}{uiText("on ")}<span className="mono">{q.claim.outcome}</span>
            </>
          )}
        </dd>
        <dt>{t('Why', '原因')}</dt>
        <dd>{uiValue(d.explanation)}</dd>
      </dl>
      <div className="tablewrap tablewrap--tall">
        {!studyTestVisible(study) && <p className="faint small">{TEST_HIDDEN_NOTE}</p>}
        <table className="tbl">
          <caption className="faint small">
            {t('Each variant against the HAC t line', '各变体相对 HAC t 阈值的结果')}{finite(line) ? ` ${num(line, 2)}` : ''}.
            <Info label={t('About the qualification funnel', '关于资格筛选流程')}>
              <p>{t('The funnel stops at the first variant that fails; later rows are context.', '筛选在第一个未通过的变体处停止；后续行仅供参考。')}</p>
              {q.selection?.dominantStyle && (
                <p>{uiText("The dominant style, chosen on train only, is ")}<span className="mono">{q.selection.dominantStyle}</span>.
                </p>
              )}
            </Info>
          </caption>
          <thead>
            <tr>
              <th scope="col">{t('Variant', '变体')}</th>
              <th scope="col">{t('Split', '数据划分')}</th>
              <th scope="col" className="r">{t('Mean rank IC', '平均秩 IC')}</th>
              <th scope="col" className="r">{uiText("HAC t")}</th>
              <th scope="col" className="r">{uiText("HAC p")}</th>
              <th scope="col">{t('Against the line', '是否达到阈值')}</th>
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
                        <th scope="row">{uiValue(label)}</th>
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
                              <span className={clears ? undefined : 'sig'}>{clears ? t('Clears', '达到') : t('Below', '低于')}</span>
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
              <dt>{uiValue(label)}</dt>
              <dd className="mono">{num(q.validation?.incremental[key], 4)}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  )
}

export function HorizonTable({ study }: { study: FactorDiagnostics }) {
  const language = useLanguage()
  const t = (en: string, zh: string) => translate(language, en, zh)
  const shown = visibleSplits(study)
  if (study.horizonProfile.length === 0) return <Empty title={t('Horizon profile', '预测周期概览')} reason={t('This Run publishes no horizon profile.', '本次运行没有发布预测周期概览。')} />
  return (
    <div className="tablewrap tablewrap--tall">
      {!studyTestVisible(study) && <p className="faint small">{TEST_HIDDEN_NOTE}</p>}
      <table className="tbl">
        <caption className="faint small">
          {language === 'zh' ? `各前瞻周期的候选因子秩 IC；选择使用 ${study.protocol.primaryHorizon} 个周期的结果。` : uiTemplate("Candidate rank IC at each forward horizon; selection reads the {0}-bar one.", [study.protocol.primaryHorizon])}
          <Info label={t('About the horizon profile', '关于预测周期概览')}>
            <p>{language === 'zh' ? `选择只使用 ${study.protocol.primaryHorizon} 个周期的结果；其他结果仅供参考。` : uiTemplate("Selection reads only the {0}-bar horizon; the others are context.", [study.protocol.primaryHorizon])}</p>
          </Info>
        </caption>
        <thead>
          <tr>
            <th scope="col">{t('Horizon', '预测周期')}</th>
            <th scope="col">{t('Split', '数据划分')}</th>
            <th scope="col" className="r">{t('Observations', '观测数')}</th>
            <th scope="col" className="r">{t('Mean rank IC', '平均秩 IC')}</th>
            <th scope="col" className="r">{t('Mean Pearson IC', '平均 Pearson IC')}</th>
            <th scope="col" className="r">{uiText("HAC t")}</th>
            <th scope="col" className="r">{uiText("HAC p")}</th>
          </tr>
        </thead>
        <tbody>
          {study.horizonProfile.flatMap((row) =>
            shown.map((split) => {
              const s = row[split]
              return (
                <tr key={`${row.horizon}-${split}`}>
                  <th scope="row">
                    {language === 'zh' ? `${row.horizon} 个周期` : uiTemplate("{0}-bar", [row.horizon])}
                    {row.horizon === study.protocol.primaryHorizon && <span className="faint small">{t('primary', '主要')}</span>}
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
  if (!stability) return <Empty title={uiText("Stability")} reason={uiText("This server does not send regime, asset and style stability.")} />
  const shown = visibleSplits(study)
  const regimes = stability.causalRegimes.filter((r) => shown.includes(r.split)).sort((a, b) => foldOrder({ split: a.split, id: a.regime }, { split: b.split, id: b.regime }))
  const assets = stability.assets.filter((r) => shown.includes(r.split)).sort((a, b) => foldOrder({ split: a.split, id: a.asset }, { split: b.split, id: b.asset }))
  const styles = stability.styles.filter((r) => shown.includes(r.split)).sort((a, b) => foldOrder({ split: a.split, id: a.style }, { split: b.split, id: b.style }))
  return (
    <div className="stack">
      {!studyTestVisible(study) && <p className="faint small">{TEST_HIDDEN_NOTE}</p>}
      <div>
        <h3 className="h-small">{uiText("By market regime")}<Info label={uiText("About market regimes")}>
            <p>{study.protocol.semantics.regimes ?? uiText("Causal trailing market direction and volatility.")}</p>
          </Info>
        </h3>
        <div className="tablewrap tablewrap--tall">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">{uiText("Regime")}</th>
                <th scope="col">{uiText("Split")}</th>
                <th scope="col" className="r">{uiText("Observations")}</th>
                <th scope="col" className="r">{uiText("Mean rank IC")}</th>
                <th scope="col" className="r">{uiText("HAC t")}</th>
                <th scope="col" className="r">{uiText("HAC p")}</th>
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
        <h3 className="h-small">{uiText("By asset")}</h3>
        <div className="tablewrap tablewrap--tall">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">{uiText("Asset")}</th>
                <th scope="col">{uiText("Split")}</th>
                <th scope="col" className="r">{uiText("Observations")}</th>
                <th scope="col" className="r">{uiText("Rank correlation")}</th>
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
        <h3 className="h-small">{uiText("Overlap with known styles")}</h3>
        <div className="tablewrap tablewrap--tall">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">{uiText("Style")}</th>
                <th scope="col">{uiText("Split")}</th>
                <th scope="col" className="r">{uiText("Observations")}</th>
                <th scope="col" className="r">{uiText("Mean rank correlation")}</th>
                <th scope="col" className="r">{uiText("Mean |rank correlation|")}</th>
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
  value ? <span className="mono hash" translate="no">{value}</span> : <span className="faint">{uiText("not recorded")}</span>

export function ProvenanceBox({ study, row }: { study: FactorDiagnostics; row: RunRow | undefined }) {
  const language = useLanguage()
  const t = (en: string, zh: string) => translate(language, en, zh)
  const h = study.harness
  const duration = row?.durationMs
  return (
    <dl className="kv box">
      <dt>{t('Run', '运行')}</dt>
      <dd className="mono" translate="no">{study.run.id}</dd>
      <dt>{t('Study', '研究')}</dt>
      <dd className="mono" translate="no">{study.run.studyId}</dd>
      <dt>{t('Started / completed (UTC)', '开始 / 完成时间 (UTC)')}</dt>
      <dd>
        {when(study.run.startedAt)} / {when(study.run.completedAt)}
        {typeof duration === 'number' && <span className="faint"> · {(duration / 1000).toFixed(1)} s</span>}
      </dd>
      <dt>{t('Input hash', '输入哈希')}</dt>
      <dd><Hash value={study.run.inputHash} /></dd>
      <dt>{t('Study hash', '研究哈希')}</dt>
      <dd><Hash value={study.run.studyHash} /></dd>
      <dt>{t('Candidate source hash', '候选源码哈希')}</dt>
      <dd><Hash value={study.run.sourceHash} /></dd>
      <dt>{t('Dataset', '数据集')}</dt>
      <dd>
        <span className="mono" translate="no">{study.dataset.id}</span>{uiText(", version ")}<span className="mono" translate="no">{study.dataset.version}</span>, {day(study.dataset.timeRange?.start)}{uiText(" to")}{' '}
        {day(study.dataset.timeRange?.end)}, {plural(study.dataset.universe.length, 'asset')}
      </dd>
      <dt>{t('Dataset hash', '数据集哈希')}</dt>
      <dd><Hash value={study.dataset.hash} /></dd>
      <dt>{uiText("Harness")}</dt>
      <dd>
        {h ? (
          <>
            <span className="mono" translate="no">{h.id}</span> {h.version}{uiText(" · Python ")}{h.python ?? '—'} · {h.buildProvenance ?? uiText("unknown build")}
          </>
        ) : (
          <span className="faint">{uiText("not recorded")}</span>
        )}
      </dd>
      <dt>{t('Harness commit', '运行环境提交')}</dt>
      <dd>
        <Hash value={h?.commit} />
        {h?.dirty !== undefined && <span className={h.dirty ? 'sig' : 'faint'}> · {h.dirty ? uiText("dirty working tree") : uiText("clean")}</span>}
      </dd>
      <dt>{t('Harness source hash', '运行环境源码哈希')}</dt>
      <dd><Hash value={h?.sourceHash} /></dd>
    </dl>
  )
}

export function ProtocolBox({ study }: { study: FactorDiagnostics }) {
  const language = useLanguage()
  const t = (en: string, zh: string) => translate(language, en, zh)
  const p = study.protocol
  const w = p.splits.splits
  const horizon = study.researchHorizon
  const c = p.causality
  return (
    <div className="stack">
      <dl className="kv box">
        <dt>{t('Causality', '因果性')}</dt>
        <dd>
          {c?.available ? (
            <>
              <span className="state"><Glyph kind="supported" />{uiText("Audited")}</span>, <span className="mono">{c.audit}</span>{uiText(" at ")}{plural(c.cuts?.length ?? 0, 'cut')}{uiText("; cross-asset context")}{' '}
              <span className="mono">{c.crossAssetContext ?? uiText("not recorded")}</span>
            </>
          ) : c ? (
            <>{uiText("Not recorded: ")}{uiValue(c.reason)}</>
          ) : (
            <span className="faint">{uiText("This server does not send the causality audit.")}</span>
          )}
        </dd>
        <dt>{t('Split', '数据划分')}</dt>
        <dd>
          <span className="mono">{p.splits.method}</span>{uiText("; candidate dependent: ")}{p.splits.candidateDependent ? uiText("yes") : uiText("no")}{uiText("; target crosses a boundary: ")}{p.splits.targetCrossesBoundary ? uiText("yes") : uiText("no")}
        </dd>
        <dt>{t('Selection', '选择')}</dt>
        <dd>{uiText("on ")}<span className="mono">{p.selectionSplit}</span>{uiText("; test is ")}<span className="mono">{p.testRole}</span>{uiText(", enters selection: ")}{p.testEntersSelection ? uiText("yes") : uiText("no")}
        </dd>
        <dt>{t('Horizon policy', '预测周期规则')}</dt>
        <dd>
          {horizon ? (
            <>
              <span className="mono">{horizon.source.horizonPolicy}</span>: {horizon.source.horizon}{uiText(". Selection reads ")}<span className="mono">{horizon.selectionAuthority.primary}</span>{uiText(" at the")}{' '}
              {horizon.primaryForwardBars}{uiText("-bar horizon; the ")}{horizon.diagnosticForwardBars.filter((b) => b !== horizon.primaryForwardBars).join(' and ')}{uiText("-bar horizons are")}{' '}
              <span className="mono">{horizon.selectionAuthority.diagnostics}</span>{uiText(". Target: ")}<span className="mono">{horizon.targetSemantics}</span>.
            </>
          ) : (
            <>{uiText("Primary ")}{p.primaryHorizon}{uiText("-bar; horizons ")}{p.horizons.join(', ')}.
            </>
          )}
        </dd>
      </dl>
      <div className="tablewrap">
        {!studyTestVisible(study) && <p className="faint small">{TEST_HIDDEN_NOTE}</p>}
        <table className="tbl">
          <caption className="faint small">
            {t('Split windows, fixed from the dataset before any candidate ran.', '数据划分窗口在任何候选运行前根据数据集固定。')}
            <Info label={t('About purged rows', '关于边界剔除行')}>
              <p>{t('Rows purged at the boundary keep forward targets from crossing it.', '剔除边界附近的行，防止前瞻目标跨越边界。')}</p>
            </Info>
          </caption>
          <thead>
            <tr>
              <th scope="col">{t('Split', '数据划分')}</th>
              <th scope="col">{t('From', '开始')}</th>
              <th scope="col">{t('To', '结束')}</th>
              <th scope="col" className="r">{t('Rows', '行数')}</th>
              {Object.keys(p.splits.horizons).map((h) => (
                <th scope="col" className="r" key={h}>{language === 'zh' ? `已剔除，${h} 个周期` : uiTemplate("Purged, {0}-bar", [h])}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleSplits(study).map((s) => (
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
  if (!row) return <p className="muted">{uiText("The Project snapshot lists no row for this Run.")}</p>
  const errors = row.errors ?? []
  const bad = errors.length > 0 || row.status !== 'succeeded'
  return (
    <>
      <p className="small">
        <span className="state">
          <Glyph kind={bad ? 'error' : 'supported'} signal={bad} />
          <span className={bad ? 'sig' : undefined}>{uiText("Status ")}{uiValue(row.status)}</span>
        </span>
        {row.failureDisposition ? (
          <>
            {' · '}{uiText("failure disposition ")}<span className="mono">{row.failureDisposition}</span>
          </>
        ) : null}
        {' · '}
        {errors.length === 0 ? uiText("no errors recorded") : uiTemplate("{0} recorded", [plural(errors.length, 'error')])}
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
