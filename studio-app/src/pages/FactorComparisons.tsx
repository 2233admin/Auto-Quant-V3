import { useEffect, useState } from 'react'
import { getJson, type FactorDiagnostics, type RunRow } from '../api'
import { ComparisonFigure } from '../components/workbench/FigureCard'
import { signedNumber } from '../design/signConvention'
import { uiTemplate, uiText } from '../i18n'
import { studyTestVisible } from './testGate'

/** Strict selected-Run identity; failure leaves the comparison absent, never borrowing a leader. */
export function FactorComparisons({ study, runs, projectId }: { study: FactorDiagnostics; runs: RunRow[]; projectId: string }) {
  const ordered = [...runs].sort((a,b) => (a.startedAt ?? '').localeCompare(b.startedAt ?? '') || a.id.localeCompare(b.id))
  const index = ordered.findIndex(r => r.id === study.run.id)
  const previous = index > 0 ? ordered[index-1] : undefined
  const [loaded, setLoaded] = useState<{ id: string; study: FactorDiagnostics | null } | null>(null)
  useEffect(() => {
    setLoaded(null)
    if (!previous || previous.status !== 'succeeded') return
    const controller = new AbortController()
    getJson<{ factorExplorer: FactorDiagnostics | null }>(`/api/v1/run?${new URLSearchParams({ project: projectId, id: previous.id })}`,controller.signal)
      .then(data => { if (!controller.signal.aborted) setLoaded({ id: previous.id, study: data.factorExplorer }) })
      .catch(() => { /* Unavailable immutable evidence is not a numeric comparison. */ })
    return () => controller.abort()
  }, [projectId, previous?.id, previous?.status])
  const prior = loaded?.id === previous?.id ? loaded?.study : null
  const current = study.summary.validation?.meanRankIc
  const before = prior?.summary.validation?.meanRankIc
  const test = studyTestVisible(study) ? study.summary.testAudit?.meanRankIc : undefined
  const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
  const format = (value: number | null | undefined) => signedNumber(value, 4)
  return <>
    {finite(current) && finite(before) && <ComparisonFigure title={uiText("Candidate versus previous trial")} label={uiText("FIG C")} subtitle={uiTemplate("Validation · Trial {0} versus {1}.", [index+1, index])}
      caption={uiTemplate("Candidate validation rank IC is {0} relative to the previous trial; this comparison does not select a candidate.", [format(current-before)])}
      baselineLabel={uiText("Previous trial")} subjectLabel={uiText("Candidate")} rows={[{ label: uiText("Mean rank IC"), baseline: before, subject: current }]} format={format} />}
    {finite(current) && finite(test) && <ComparisonFigure title={uiText("Validation versus test")} label={uiText("FIG D")} subtitle={uiText("Published test audit · never selection evidence.")}
      caption={uiTemplate("Test audit mean rank IC is {0} versus {1} on validation; this is not independent confirmation.", [format(test), format(current)])}
      baselineLabel={uiText("Validation")} subjectLabel={uiText("Test audit")} rows={[{ label: uiText("Mean rank IC"), baseline: current, subject: test }]} format={format} />}
  </>
}
