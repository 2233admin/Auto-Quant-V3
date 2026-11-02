import { uiTemplate, uiText, uiValue } from '../../i18n'
import { useEffect } from 'react'
import type { ProjectSnapshot, RankSummary } from '../../api'
import { num, plural, when } from '../../format'
import { Section } from '../../design/layout'
import { LaunchedLabel } from '../../actions/LaunchedLabel'
import { RunAnalysisButton } from '../../actions/RunAnalysisButton'
import { Notice } from '../../Notice'
import { HeadlineMetrics, type HeadlineSplit } from '../../components/HeadlineMetrics'
import { Info } from '../../components/Info'
import { NotPublished } from '../../components/NotPublished'
import { pickIntegrity, TrialCounter } from '../../components/TrialCounter'
import { FactChips, MetricGrid, PaneCard, Tabs, useHashTab, VerdictBar, WorkbenchShell, type Fact, type MetricGroup, type TabDef } from '../../components/workbench'
import { routeHref } from '../../route'
import { buildVerdict, QualificationBlock, topReasons, VerdictReasons, verdictClause, verdictSentence } from '../FactorEvidence'
import { adjustmentOf } from '../FactorWorkbench'
import { SPLIT_LABEL, SPLITS } from '../factorMath'
import { RunList } from './RunList'
import { RunSelect } from './RunSelect'
import { IcByHorizonCard, IcByHorizonTable } from '../FactorCharts'
import { gatedSplits, TEST_HIDDEN_NOTE } from '../testGate'
import { otherLaneOf, short, testAuditVisible, type RunDiagnostics } from './runTypes'
import { useRun } from './useRun'
import './run.css'

const day = (iso: string | undefined) => (iso ? iso.slice(0, 10) : '—')

function SplitRow({ name, role, s }: { name: string; role: string; s: RankSummary | undefined }) {
  return (
    <tr>
      <th scope="row">{name}<span className="faint small">{uiValue(role)}</span></th>
      <td className="r num">{num(s?.meanRankIc, 4)}</td>
      <td className="r num">{num(s?.rankIcir, 3)}</td>
      <td className="r num">{num(s?.hacTStatistic, 2)}</td>
      <td className="r num">{num(s?.hacNormalPValue, 3)}</td>
      <td className="r num">{num(s?.rankHitRate, 3)}</td>
      <td className="r num">{s ? s.observations.toLocaleString('en-US') : '—'}</td>
    </tr>
  )
}

type TabId = 'evidence' | 'checks' | 'provenance' | 'runs'
const TAB_IDS = ['evidence', 'checks', 'provenance', 'runs'] as const
/** Old section anchors now live inside a tab. */
const ANCHOR_TAB: Record<string, TabId> = {
  'run-headline': 'evidence',
  'run-ic-table': 'evidence',
  'run-splits': 'evidence',
  'run-horizons': 'evidence',
  'run-reasons': 'checks',
  'run-qualification': 'checks',
  'run-provenance': 'provenance',
  'run-all': 'runs',
}

const VERDICT_WORD = { pass: 'Pass', fail: 'Fail', inconclusive: 'Inconclusive' } as const
const int = (v: number) => v.toLocaleString('en-US')

/** The published validation (and, only when its audit is visible, test) numbers as compact tiles. */
function metricGroups(fe: RunDiagnostics, project: ProjectSnapshot, showTest: boolean): MetricGroup[] {
  const v = fe.summary.validation
  const t = fe.summary.testAudit
  const horizon = fe.protocol.primaryHorizon
  const fam = pickIntegrity(project)?.researchFamily
  const measure = fe.protocol.semantics?.measure ? <p>{fe.protocol.semantics.measure}</p> : undefined
  const inference = fe.protocol.semantics?.inference ? <p>{fe.protocol.semantics.inference}</p> : undefined
  const groups: MetricGroup[] = []
  if (v) {
    const weak = v.sufficient === false
    groups.push({
      heading: uiTemplate("Validation · selection split · {0}-bar horizon", [horizon]),
      label: uiTemplate("Validation split, {0}-bar horizon", [horizon]),
      tiles: [
        { label: uiText("Mean rank IC"), value: num(v.meanRankIc, 4), info: measure },
        { label: uiText("HAC t"), value: num(v.hacTStatistic, 2), info: inference },
        { label: uiText("HAC p"), value: num(v.hacNormalPValue, 3), info: <>{inference}<p>{uiText("Two-sided.")}</p></> },
        { label: uiText("Hit rate"), value: num(v.rankHitRate, 3), info: <p>{uiText("Share of bars with rank IC above 0.")}</p> },
        { label: uiText("Rank IC IR"), value: num(v.rankIcir, 3) },
        { label: uiText("Mean Pearson IC"), value: num(v.meanPearsonIc, 4) },
        { label: uiText("Rank IC std"), value: num(v.rankIcStandardDeviation, 3) },
        { label: uiText("Observations"), value: int(v.observations), info: <p>{uiText("Minimum required: ")}{int(v.minimumObservations)}{uiText(" observations.")}</p>, tone: weak ? 'weak' : 'neutral', toneReason: weak ? 'below min' : undefined },
        { label: uiText("Trials counted"), value: fam ? int(fam.totalExecutions) : '—', info: <p>{fam ? uiTemplate("{0} unique candidate sources among {1} executions.", [int(fam.uniqueSourceTrials), int(fam.totalExecutions)]) : uiText("No Session ledger records the trials.")}</p> },
      ],
    })
  }
  if (showTest && t) {
    groups.push({
      heading: uiText("Test · visible audit, not used for selection"),
      label: uiTemplate("Test split visible audit, {0}-bar horizon", [horizon]),
      tiles: [
        { label: uiText("Mean rank IC"), value: num(t.meanRankIc, 4) },
        { label: uiText("HAC t"), value: num(t.hacTStatistic, 2) },
        { label: uiText("HAC p"), value: num(t.hacNormalPValue, 3) },
        { label: uiText("Hit rate"), value: num(t.rankHitRate, 3) },
        { label: uiText("Observations"), value: int(t.observations), info: <p>{uiText("Minimum required: ")}{int(t.minimumObservations)}{uiText(" observations.")}</p> },
      ],
    })
  }
  return groups
}

/** "What was tested": the locked Study and Run facts. */
function testedFacts(fe: RunDiagnostics): Fact[] {
  const { protocol } = fe
  const windows = protocol.splits.splits
  const context = protocol.horizons.filter((h) => h !== protocol.primaryHorizon).sort((a, b) => a - b)
  return [
    { label: uiText("Study"), value: fe.run.studyId, mono: true },
    { label: uiText("Run started"), value: `${when(fe.run.startedAt)} UTC` },
    { label: uiText("Dataset"), value: `${fe.dataset.id} · ${day(fe.dataset.timeRange?.start)} to ${day(fe.dataset.timeRange?.end)}`, mono: true },
    { label: uiText("Scored asset"), value: (fe.predictionUniverse.predictionAssets ?? []).join(', ') || '—', mono: true },
    { label: uiText("Evaluation mode"), value: fe.predictionUniverse.evaluationMode ?? '—', mono: true },
    { label: uiText("Horizon"), value: `${protocol.primaryHorizon}-bar primary${context.length ? ` · context ${context.join(', ')}-bar` : ''}` },
    ...gatedSplits(fe, SPLITS).map((s) => ({ label: uiTemplate("{0} window", [SPLIT_LABEL[s]]), value: `${day(windows[s].start)} to ${day(windows[s].end)}` })),
  ]
}

function Body({ fe, project }: { fe: RunDiagnostics; project: ProjectSnapshot }) {
  const v = fe.summary.validation
  const showTest = testAuditVisible(fe)
  const windows = fe.protocol.splits.splits
  const row = project.runs.find((r) => r.id === fe.run.id)
  const adjustment = adjustmentOf(project)
  const headlineSplits: HeadlineSplit[] = [
    ...(v ? [{ name: 'Validation', role: 'selection split', summary: v }] : []),
    ...(showTest && fe.summary.testAudit ? [{ name: 'Test', role: 'visible audit, not used for selection', summary: fe.summary.testAudit }] : []),
  ]
  const { verdict, reasons } = buildVerdict(fe, adjustment)
  const [tab, selectTab, anchor] = useHashTab<TabId>(TAB_IDS, 'evidence', ANCHOR_TAB)
  useEffect(() => {
    if (anchor) requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ block: 'start' }))
  }, [anchor, tab])
  const tabs: TabDef<TabId>[] = [
    { id: 'evidence', label: uiText("Evidence") },
    { id: 'checks', label: uiText("Checks") },
    { id: 'provenance', label: uiText("Provenance") },
    { id: 'runs', label: uiText("All Runs"), badge: String(project.runs.length) },
  ]
  return (
    <>
      <VerdictBar tone={verdict === 'fail' ? 'bad' : verdict === 'pass' ? 'ok' : 'warn'} word={VERDICT_WORD[verdict]} reasons={topReasons(reasons).map((r) => ({ tone: r.tone === 'bad' ? 'bad' : 'info', text: r.text, field: r.field }))} detail={verdictSentence(fe, adjustment, verdict)}>
        {verdictClause(fe, verdict)}
      </VerdictBar>
      <IcByHorizonCard study={fe} table={false} />
      <MetricGrid groups={metricGroups(fe, project, showTest)} hiddenNote={showTest ? undefined : TEST_HIDDEN_NOTE} />
      <TrialCounter project={project} />
      <Tabs
        label={uiText("Run sections")}
        tabs={tabs}
        active={tab}
        onSelect={selectTab}
        panels={{
          evidence: (
            <>
              <Section title={uiText("Rank IC by horizon and split")} id="run-ic-table" caption={uiText("The numbers behind the chart.")}>
                <div className="tablewrap">
                  <IcByHorizonTable study={fe} />
                </div>
              </Section>
              <Section title={uiText("By split")} id="run-splits" caption={showTest ? undefined : TEST_HIDDEN_NOTE}>
                <div className="tablewrap">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th scope="col">{uiText("Split")}</th>
                        <th scope="col" className="r">{uiText("Mean rank IC")}</th>
                        <th scope="col" className="r">{uiText("IC IR")}</th>
                        <th scope="col" className="r">{uiText("HAC t")}</th>
                        <th scope="col" className="r">p</th>
                        <th scope="col" className="r">{uiText("Hit rate")}</th>
                        <th scope="col" className="r">{uiText("Obs.")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <SplitRow name={`Validation (${day(windows.validation.start)} to ${day(windows.validation.end)})`} role="selection split" s={v} />
                      {showTest && <SplitRow name={`Test (${day(windows.test.start)} to ${day(windows.test.end)})`} role="visible audit, not used for selection" s={fe.summary.testAudit} />}
                    </tbody>
                  </table>
                </div>
              </Section>
              <Section title={uiText("Horizon profile (validation)")} id="run-horizons">
                <div className="tablewrap">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th scope="col">{uiText("Horizon (bars)")}</th>
                        <th scope="col" className="r">{uiText("Mean rank IC")}</th>
                        <th scope="col" className="r">{uiText("HAC t")}</th>
                        <th scope="col" className="r">p</th>
                        <th scope="col" className="r">{uiText("Obs.")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fe.horizonProfile.map((h) => (
                        <tr key={h.horizon}>
                          <th scope="row">{h.horizon}{h.horizon === fe.protocol.primaryHorizon && <span className="faint small">{uiText("primary")}</span>}</th>
                          <td className="r num">{num(h.validation.meanRankIc, 4)}</td>
                          <td className="r num">{num(h.validation.hacTStatistic, 2)}</td>
                          <td className="r num">{num(h.validation.hacNormalPValue, 3)}</td>
                          <td className="r num">{h.validation.observations.toLocaleString('en-US')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
              <Section
                title={uiText("All headline figures")}
                id="run-headline"
                caption={
                  <>{uiText("Selection uses the validation split only; primary horizon ")}{fe.protocol.primaryHorizon}{uiText(" bars.")}{' '}
                    <Info label={uiText("About this Run")}>
                      <p>{fe.run.summary ?? uiText("This Run publishes no summary line.")}</p>
                    </Info>
                  </>
                }
              >
                <HeadlineMetrics splits={headlineSplits} horizon={fe.protocol.primaryHorizon} defs={fe.protocol.semantics} />
              </Section>
            </>
          ),
          checks: (
            <>
              <Section title={uiText("Why this verdict")} id="run-reasons" caption={uiText("Every reason behind the verdict; the ? opens the field it reads.")}>
                <VerdictReasons study={fe} adjustment={adjustment} />
              </Section>
              {fe.factorQualification.diagnosis && (
                <Section title={uiText("Qualification diagnosis")} id="run-qualification">
                  <QualificationBlock study={fe} />
                </Section>
              )}
            </>
          ),
          provenance: (
            <>
              <Section title={uiText("Provenance")} id="run-provenance" caption={uiText("Hashes, dataset and harness that produced this Run.")}>
                <dl className="kv">
                  <dt>{uiText("Run")}</dt><dd className="mono">{fe.run.id}</dd>
                  <dt>{uiText("Status")}</dt><dd>{fe.run.status ?? row?.status ?? '—'}</dd>
                  <dt>{uiText("Started / completed (UTC)")}</dt><dd className="mono">{when(fe.run.startedAt)} / {when(fe.run.completedAt)}</dd>
                  <dt>{uiText("Study")}</dt><dd className="mono">{fe.run.studyId}</dd>
                  <dt>{uiText("Candidate source hash")}</dt><dd className="mono" title={fe.run.sourceHash}>{short(fe.run.sourceHash, 16)}</dd>
                  <dt>{uiText("Study hash")}</dt><dd className="mono" title={fe.run.studyHash}>{short(fe.run.studyHash, 16)}</dd>
                  <dt>{uiText("Input hash")}</dt><dd className="mono" title={fe.run.inputHash}>{short(fe.run.inputHash, 16)}</dd>
                  <dt>{uiText("Dataset")}</dt><dd className="mono">{fe.dataset.id} {fe.dataset.version}</dd>
                  <dt>{uiText("Dataset hash")}</dt><dd className="mono" title={fe.dataset.hash}>{short(fe.dataset.hash, 16)}</dd>
                  <dt>{uiText("Dataset window")}</dt><dd className="mono">{day(fe.dataset.timeRange?.start)}{uiText(" to ")}{day(fe.dataset.timeRange?.end)}</dd>
                  <dt>{uiText("Universe")}</dt><dd>{fe.dataset.universe.join(', ')}</dd>
                  <dt>{uiText("Prediction assets")}</dt><dd>{(fe.predictionUniverse.predictionAssets ?? []).join(', ') || '—'}</dd>
                  <dt>{uiText("Research horizon id")}</dt><dd className="mono">{fe.researchHorizon?.id ?? '—'}</dd>
                  <dt>{uiText("Harness")}</dt><dd className="mono">{fe.harness ? `${fe.harness.id ?? ''} ${fe.harness.version ?? ''}${fe.harness.dirty ? ' (dirty)' : ''}` : '—'}</dd>
                </dl>
              </Section>
              <NotPublished />
            </>
          ),
          runs: (
            <Section title={uiText("All Runs of this Project")} id="run-all">
              <RunList project={project} />
            </Section>
          ),
        }}
      />
      {fe.warning && <p className="small muted">{uiValue(fe.warning)}</p>}
    </>
  )
}

/** One Run of a Project. Factor Runs load from the read-only /api/v1/run route; a Run of any other lane is sent to that lane's page before any fetch. */
export function RunPage({ project, runId, go }: { project: ProjectSnapshot; runId: string; go: (href: string, options?: { replace?: boolean }) => void }) {
  const other = otherLaneOf(project, runId)
  const load = useRun(project.id, other ? undefined : runId)
  const study = project.runs.find((r) => r.id === runId)?.studyId
  const factorHref = routeHref({ view: 'factor', id: project.id, run: runId, ...(study ? { study } : {}) })
  const fe = load.state === 'ready' ? load.payload.factorExplorer : null
  const laneHref = other ? routeHref({ view: other.view, id: project.id }) : null
  useEffect(() => {
    if (laneHref) go(laneHref, { replace: true })
  }, [laneHref, go])
  if (other && laneHref) {
    return (
      <div className="pg">
        <p className="muted">{uiText("Opening the ")}{other.lane}{uiText(" page for this Run…")}</p>
        <p>
          <a href={laneHref}>{uiText("Open ")}{other.lane}</a>
        </p>
      </div>
    )
  }
  const runLabelId = runId.replace(/^run-/, '')
  const left = (
    <PaneCard label={uiText("What was tested")} actions={<RunAnalysisButton project={project} preferStudyId={study} />}>
      <header className="rp-lhead">
        <h1>{uiText("Run ")}<span className="mono" translate="no">{runLabelId}</span>
        </h1>
        <p className="muted small">
          {plural(project.runs.length, 'Run')}{uiText(" in this Project. ")}<LaunchedLabel runId={runId} />
        </p>
      </header>
      <RunSelect bar label={uiText("Run")} runs={project.runs} value={runId} onChange={(id) => go(routeHref({ view: 'run', id: project.id, run: id }))} />
      <nav className="rp-links" aria-label={uiText("Related pages")}>
        <a href={factorHref}>{uiText("Full Factor evidence")}</a>
        <a href={routeHref({ view: 'compare', id: project.id, a: runId })}>{uiText("Compare")}</a>
        <a href={routeHref({ view: 'project', id: project.id })}>{uiText("Open Project")}</a>
      </nav>
      {fe && <FactChips label={uiText("What was tested")} locked facts={testedFacts(fe)} info={<p>{uiText("These values come from the Study and the Run. They are read-only here.")}</p>} />}
    </PaneCard>
  )
  const right = (
    <PaneCard label={uiText("Run result")}>
      {load.state === 'loading' && <p className="muted">{uiText("Loading Run…")}</p>}
      {load.state === 'error' &&
        (load.unsupported ? (
          <Notice
            kind="info"
            label={uiText("Info")}
            title={uiText("This Run is not a Factor Run, so it has no Factor evidence page.")}
            subtitle={uiText("The Run route serves Factor Runs only. Open the Project to find the page for this Run's lane.")}
          />
        ) : (
          <Notice kind="error" label={uiText("Error")} title={uiText("Could not load this Run.")} subtitle={load.message} />
        ))}
      {load.state === 'error' && load.unsupported && (
        <p className="small">
          <a href={routeHref({ view: 'project', id: project.id })}>{uiText("Open Project")}</a> · <a href={routeHref({ view: 'runs' })}>{uiText("Run history")}</a>
        </p>
      )}
      {fe && <Body fe={fe} project={project} />}
      {!fe && (
        <Section title={uiText("All Runs of this Project")} id="run-all">
          <RunList project={project} />
        </Section>
      )}
    </PaneCard>
  )
  return <WorkbenchShell left={left} right={right} ratio={34} />
}
