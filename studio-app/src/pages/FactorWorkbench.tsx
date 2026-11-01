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
      heading: `Validation · selection split · ${horizon}-bar horizon`,
      label: `Validation split, ${horizon}-bar horizon`,
      tiles: [
        { label: 'Mean rank IC', value: num(validation.meanRankIc, 4), info: measure },
        { label: 'HAC t', value: num(validation.hacTStatistic, 2), info: inference },
        { label: 'HAC p', value: num(validation.hacNormalPValue, 3), info: <>{inference}<p>Two-sided.</p></> },
        { label: 'Hit rate', value: num(validation.rankHitRate, 3), info: <p>Share of bars with rank IC above 0.</p> },
        { label: 'Rank IC IR', value: num(validation.rankIcir, 3) },
        { label: 'Mean Pearson IC', value: num(validation.meanPearsonIc, 4) },
        { label: 'Rank IC std', value: num(validation.rankIcStandardDeviation, 3) },
        {
          label: 'Observations',
          value: int(validation.observations),
          info: <p>Minimum required: {int(validation.minimumObservations)} observations.</p>,
          tone: weak ? 'weak' : 'neutral',
          toneReason: weak ? 'below min' : undefined,
        },
        { label: 'Trials counted', value: fam ? int(fam.totalExecutions) : '—', info: <p>{fam ? `${int(fam.uniqueSourceTrials)} unique candidate sources among ${int(fam.totalExecutions)} executions.` : 'No Session ledger records the trials.'}</p> },
      ],
    },
  ]
  if (testVisible && testAudit) {
    groups.push({
      heading: 'Test · visible audit, not used for selection',
      label: `Test split visible audit, ${horizon}-bar horizon`,
      tiles: [
        { label: 'Mean rank IC', value: num(testAudit.meanRankIc, 4) },
        { label: 'HAC t', value: num(testAudit.hacTStatistic, 2) },
        { label: 'HAC p', value: num(testAudit.hacNormalPValue, 3) },
        { label: 'Hit rate', value: num(testAudit.rankHitRate, 3) },
        { label: 'Observations', value: int(testAudit.observations), info: <p>Minimum required: {int(testAudit.minimumObservations)} observations.</p> },
      ],
    })
  }
  return groups
}
