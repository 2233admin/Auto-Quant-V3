import { uiTemplate, uiText } from '../i18n'
import type { FactorDiagnostics, ProjectSnapshot, RankSummary } from '../api'
import type { MetricGroup } from '../components/workbench'
import { pickIntegrity } from '../components/TrialCounter'
import { num } from '../format'

const int = (v: number) => v.toLocaleString('en-US')

/** The Session ledger's selection adjustment for the validation-IC metric, if any Session recorded one. */
export const adjustmentOf = (project: ProjectSnapshot) =>
  project.sessions.map((s) => s.selectionIntegrity).find((s) => s?.selectionMetric === 'validation_mean_ic')?.selectionAdjustment

// ---------------------------------------------------------------------------------------------
// Core tiles

export type CoreDefs = { inference?: string; measure?: string }

const defNode = (d?: string) => (d ? <p>{d}</p> : undefined)

type CoreArgs = {
  study: Pick<FactorDiagnostics, 'protocol'>
  project: ProjectSnapshot
  validation: RankSummary | undefined
  testAudit: RankSummary | undefined
  testVisible: boolean
  defs?: CoreDefs
}

/**
 * The published numbers for the validation split, plus the test-audit group only when the protocol marks test as a visible
 * diagnostic. Empty when the Run published no validation summary. Rendered by `MetricGrid`.
 */
export function coreGroups({ study, project, validation, testAudit, testVisible, defs }: CoreArgs): MetricGroup[] {
  if (!validation) return []
  const fam = pickIntegrity(project)?.researchFamily
  const horizon = study.protocol.primaryHorizon
  const weak = validation.sufficient === false
  const measure = defNode(defs?.measure)
  const inference = defNode(defs?.inference)
  const groups: MetricGroup[] = [
    {
      heading: uiTemplate("Validation · selection split · {0}-bar horizon", [horizon]),
      label: uiTemplate("Validation split, {0}-bar horizon", [horizon]),
      tiles: [
        { label: uiText("Mean rank IC"), value: num(validation.meanRankIc, 4), info: measure, metric: 'meanRankIc' },
        { label: uiText("HAC t"), value: num(validation.hacTStatistic, 2), info: inference, metric: 'hacT' },
        { label: uiText("HAC p"), value: num(validation.hacNormalPValue, 3), info: <>{inference}<p>{uiText("Two-sided.")}</p></>, metric: 'hacP' },
        { label: uiText("Hit rate"), value: num(validation.rankHitRate, 3), metric: 'rankHitRate' },
        { label: uiText("Rank IC IR"), value: num(validation.rankIcir, 3), metric: 'rankIcir' },
        { label: uiText("Mean Pearson IC"), value: num(validation.meanPearsonIc, 4), metric: 'meanPearsonIc' },
        { label: uiText("Rank IC std"), value: num(validation.rankIcStandardDeviation, 3), metric: 'rankIcStd' },
        {
          label: uiText("Observations"),
          value: int(validation.observations),
          info: <p>{uiText("Minimum required: ")}{int(validation.minimumObservations)}{uiText(" observations.")}</p>,
          tone: weak ? 'weak' : 'neutral',
          toneReason: weak ? 'below min' : undefined,
          metric: 'observations',
        },
        { label: uiText("Trials counted"), value: fam ? int(fam.totalExecutions) : '—', info: <p>{fam ? uiTemplate("{0} unique candidate sources among {1} executions.", [int(fam.uniqueSourceTrials), int(fam.totalExecutions)]) : uiText("No Session ledger records the trials.")}</p>, metric: 'trialsCounted' },
      ],
    },
  ]
  if (testVisible && testAudit) {
    groups.push({
      heading: uiText("Test · visible audit, not used for selection"),
      label: uiTemplate("Test split visible audit, {0}-bar horizon", [horizon]),
      tiles: [
        { label: uiText("Mean rank IC"), value: num(testAudit.meanRankIc, 4), metric: 'meanRankIc' },
        { label: uiText("HAC t"), value: num(testAudit.hacTStatistic, 2), metric: 'hacT' },
        { label: uiText("HAC p"), value: num(testAudit.hacNormalPValue, 3), metric: 'hacP' },
        { label: uiText("Hit rate"), value: num(testAudit.rankHitRate, 3), metric: 'rankHitRate' },
        { label: uiText("Observations"), value: int(testAudit.observations), info: <p>{uiText("Minimum required: ")}{int(testAudit.minimumObservations)}{uiText(" observations.")}</p>, metric: 'observations' },
      ],
    })
  }
  return groups
}
