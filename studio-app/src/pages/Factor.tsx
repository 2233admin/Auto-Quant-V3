import { translate, uiTemplate, uiText, uiValue, useLanguage } from '../i18n'
import { useEffect, useState, type ReactNode } from 'react'
import { getJson, type FactorDiagnostics, type ProjectSnapshot, type RunRow } from '../api'
import { Glyph } from '../design/icons'
import { num, plural, when } from '../format'
import { Section } from '../design/layout'
import { Notice } from '../Notice'
import { routeHref } from '../route'
import { FactorHero, spreadGroups } from './GroupReturn'
import { IcOverTime, Empty, NoiseFrontierChart, Quantiles } from './FactorCharts'
import { gatedSplits, studyTestVisible, TEST_HIDDEN_NOTE } from './testGate'
import { noiseFrontier, SPLITS, type FrontierResult } from './factorMath'
import { FactorVerdict, FoldTable, HorizonTable, ProtocolBox, ProvenanceBox, QualificationBlock, RunErrors, StabilityTables, VerdictReasons } from './FactorEvidence'
import { adjustmentOf, coreGroups } from './FactorWorkbench'
import { ActionRow, FactsDialog, MetricGrid, PaneCard, StatChips, StatusLine, Tabs, useHashTab, WorkbenchShell, type ActionButton, type Stat, type TabDef } from '../components/workbench'
import { downloadJson } from '../download'
import { useActions } from '../actions/ActionsContext'
import { LoopProgress, LoopResult, type LoopOutcome } from '../actions/LoopProgress'
import { FactorEditor, lockedFacts } from './FactorEditor'
import { otherLaneOf } from './run/runTypes'
import { Info } from '../components/Info'
import { HeadlineMetrics, type HeadlineSplit } from '../components/HeadlineMetrics'
import { NotPublished } from '../components/NotPublished'
import { TrialCounter } from '../components/TrialCounter'
import './factor.css'
import { DiagnosticText } from '../components/DiagnosticText'

type Check = { id: string; group: string; state: 'pass' | 'fail' | 'info'; label: string; detail: ReactNode }

const STATE_WORD = { pass: 'Pass', fail: 'Fail', info: 'Not a pass/fail' } as const

const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '—')
const int = (v: number) => v.toLocaleString('en-US')

/** Every row is derived from a field the Run or the Session ledger publishes; nothing is inferred beyond booleans and date order. */
function buildChecks(study: FactorDiagnostics, frontier: FrontierResult, projectSessions: ProjectSnapshot['sessions']): Check[] {
  const { protocol } = study
  const windows = protocol.splits.splits
  const ordered =
    Date.parse(windows.train.end) < Date.parse(windows.validation.start) && Date.parse(windows.validation.end) < Date.parse(windows.test.start)
  const profile = study.horizonProfile
  const shown = gatedSplits(study, SPLITS)
  const showTest = studyTestVisible(study)
  const insufficient = profile.flatMap((row) => shown.filter((s) => !row[s].sufficient).map((s) => `${row.horizon}-bar ${s}`))
  const purged = Object.entries(protocol.splits.horizons)
    .map(([h, byHorizon]) => `${h}-bar: ${byHorizon.validation.purgedBoundaryRows}`)
    .join(', ')
  const primary = profile.find((row) => row.horizon === protocol.primaryHorizon)?.validation
  const tStat = primary?.hacTStatistic ?? null
  const causality = protocol.causality
  const qualification = study.factorQualification
  const integrity = projectSessions.map((s) => s.selectionIntegrity).find((s) => s?.selectionMetric === 'validation_mean_ic')
  const checks: Check[] = [
    {
      id: 'selection-split',
      group: 'Research integrity',
      state: protocol.selectionSplit === 'validation' && protocol.testEntersSelection === false ? 'pass' : 'fail',
      label: uiText("Selection uses the validation split only"),
      detail: uiTemplate("Selection split {0}; test enters selection: {1}.", [protocol.selectionSplit, protocol.testEntersSelection ? 'yes' : 'no']),
    },
    {
      id: 'test-role',
      group: 'Research integrity',
      state: 'info',
      label: showTest ? 'Test split is a visible diagnostic' : 'Test split is hidden until its audit exists',
      detail: uiTemplate("Test role {0}. {1}", [protocol.testRole, integrity?.externalHoldoutRequired
          ? 'The Session ledger requires a new external holdout before a fresh production-grade claim.'
          : 'No Session ledger says whether an external holdout is required.']),
    },
    {
      id: 'split-method',
      group: 'Split protocol',
      state: protocol.splits.candidateDependent === false ? 'pass' : 'fail',
      label: uiText("Split boundaries do not depend on the candidate"),
      detail: <>{uiText("Method ")}<span className="mono">{protocol.splits.method}</span>{uiText("; candidate dependent: ")}{protocol.splits.candidateDependent ? uiText("yes") : uiText("no")}.</>,
    },
    {
      id: 'split-order',
      group: 'Split protocol',
      state: ordered ? 'pass' : 'fail',
      label: uiText("Train, validation and test are chronological and disjoint"),
      detail: uiTemplate("Train to {0}, validation {1} to {2}{3}.{4}", [day(windows.train.end), day(windows.validation.start), day(windows.validation.end), showTest ? `, test from ${day(windows.test.start)}` : '', showTest ? '' : ` ${TEST_HIDDEN_NOTE}.`]),
    },
    {
      id: 'purge',
      group: 'Split protocol',
      state: protocol.splits.targetCrossesBoundary === false ? 'pass' : 'fail',
      label: uiText("Forward targets do not cross a split boundary"),
      detail: uiTemplate("Boundary rows purged before validation: {0}.", [purged]),
    },
    {
      id: 'sufficient',
      group: 'Split protocol',
      state: insufficient.length === 0 ? 'pass' : 'fail',
      label: uiText("Every horizon and split meets its minimum observation count"),
      detail: insufficient.length === 0 ? `${plural(profile.length * shown.length, 'cell')} checked.` : `Below minimum: ${insufficient.join(', ')}.`,
    },
    causality?.available
      ? {
          id: 'causality',
          group: 'Causality audit',
          state: 'pass',
          label: uiText("Factor values at each timestamp use only data up to that timestamp"),
          detail: (
            <>{uiText("Audit ")}<span className="mono">{causality.audit}</span>{uiText(" at ")}{plural(causality.cuts?.length ?? 0, 'cut')}{uiText("; cross-asset context")}{' '}
              <span className="mono">{causality.crossAssetContext ?? uiText("not recorded")}</span>.
            </>
          ),
        }
      : {
          id: 'causality',
          group: 'Causality audit',
          state: 'info',
          label: uiText("Causality audit"),
          detail: causality ? `Not recorded for this Run (${causality.reason}).` : 'This server does not send the causality audit; restart it on the current build.',
        },
    {
      id: 'validation-t',
      group: 'Evidence',
      state: tStat === null ? 'info' : Math.abs(tStat) >= 1.96 && (primary?.meanRankIc ?? 0) > 0 ? 'pass' : 'fail',
      label: uiTemplate("Validation {0}-bar mean IC is positive with HAC |t| ≥ 1.96", [protocol.primaryHorizon]),
      detail: primary ? `Mean IC ${num(primary.meanRankIc, 4)}, HAC t ${num(tStat, 2)}, p ${num(primary.hacNormalPValue, 3)}, ${int(primary.observations)} observations.` : 'No validation summary.',
    },
    frontier.ok && frontier.value.passes !== null
      ? {
          id: 'familywise',
          group: 'Evidence',
          state: frontier.value.passes ? 'pass' : 'fail',
          label: uiText("Selected IC survives the family-wise HAC rule"),
          detail: uiTemplate("Raw p {0} × {1} trials = adjusted p {2}; the rule needs ≤ 0.05.", [num(frontier.value.rawP, 3), frontier.value.trials, num(frontier.value.adjustedP, 3)]),
        }
      : {
          id: 'familywise',
          group: 'Evidence',
          state: 'info',
          label: uiText("Selected IC survives the family-wise HAC rule"),
          detail: frontier.ok ? 'The ledger publishes no verdict.' : frontier.reason,
        },
    {
      id: 'qualification',
      group: 'Evidence',
      state: qualification.diagnosis ? (qualification.diagnosis.qualifiesForPortfolio ? 'pass' : 'fail') : 'info',
      label: uiText("Factor qualifies for portfolio research"),
      detail: qualification.diagnosis ? `Stage ${qualification.diagnosis.stage}. ${qualification.diagnosis.explanation}` : 'This Run has no Factor qualification.',
    },
  ]
  return checks
}

function Ledger({ checks }: { checks: Check[] }) {
  return (
    <div className="tablewrap">
      <table className="tbl ledger">
        <thead>
          <tr>
            <th scope="col">{uiText("Check")}</th>
            <th scope="col">{uiText("Result")}</th>
            <th scope="col">{uiText("Basis")}</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((c) => (
            <tr key={c.id}>
              <th scope="row">
                {uiValue(c.label)}
                <span className="faint small">{c.group}</span>
              </th>
              <td>
                <span className="state">
                  <Glyph kind={c.state === 'pass' ? 'supported' : c.state === 'fail' ? 'error' : 'empty'} signal={c.state === 'fail'} />
                  <span className={c.state === 'fail' ? 'sig' : undefined}>{STATE_WORD[c.state]}</span>
                </span>
              </td>
              <td className="basis">{c.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Limits({ study, frontier }: { study: FactorDiagnostics; frontier: FrontierResult }) {
  const mode = study.predictionUniverse.evaluationMode ?? 'unspecified'
  const assets = study.predictionUniverse.predictionAssets ?? []
  const trials = frontier.ok ? frontier.value.trials : null
  return (
    <>
      <div className="two">
        <div>
          <h3 className="h-small">{uiText("What the numbers show")}</h3>
          <ul className="bullets">
            <li>{uiText("How well the factor ranks next-")}{study.protocol.primaryHorizon}{uiText("-bar returns ")}<em>{uiText("over time")}</em>{uiText(" for")}{' '}
              <span className="mono" translate="no">{assets.join(', ') || 'the prediction asset'}</span>{uiText(", split into train, validation and test windows.")}</li>
            <li>{uiText("Whether each split's mean IC is distinguishable from zero, using a HAC standard error whose maximum lag equals the forward horizon.")}</li>
            <li>{uiText("The selection-adjusted view for the trials the Project ledger records.")}</li>
          </ul>
        </div>
        <div>
          <h3 className="h-small">{uiText("What they do not show")}</h3>
          <ul className="bullets">
            <li>{uiText("Cross-sectional ranking skill. The evaluation mode is ")}<span className="mono">{mode}</span>{uiText(": one asset scored through time, so there is no population to rank and no quantile groups.")}</li>
            <li>{uiText("Independence of trials.")}{' '}
              {trials === null
                ? uiText("No trial ledger is available, so the number of tried candidates is unknown.")
                : uiTemplate("N = {0} is an upper bound counted from unique candidate sources; ideas tried outside this Project are not counted.", [trials])}
            </li>
            <li>{uiText("Overlap-free samples. Forward returns overlap, so observations are not independent; the HAC lag corrects the standard error, not the sample size.")}</li>
            <li>{uiText("Tradable performance. Costs, capacity and execution are outside this Run, and its trading authority is none.")}</li>
          </ul>
        </div>
      </div>
    </>
  )
}

/** Every Factor Run of the Project, newest first, as one full-width select. Only the Run in `project.factorExplorer` is inlined; the rest load from /api/v1/run. */
function RunSelector({ project, shown, loading, go }: { project: ProjectSnapshot; shown: string; loading: boolean; go: (href: string) => void }) {
  const runs = project.runs.filter((r) => r.subject.kind === 'factor' && !otherLaneOf(project, r.id)).sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  if (runs.length === 0) return null
  const latest = project.factorExplorer?.run.id
  return (
    <label className="runsel runsel--bar">
      <span className="sr-only">{uiText("Factor Run")}</span>
      <select
        value={runs.some((r) => r.id === shown) ? shown : ''}
        onChange={(event) => go(routeHref({ view: 'factor', id: project.id, run: event.target.value }))}
      >
        {!runs.some((r) => r.id === shown) && <option value="">{uiText("Choose a Run…")}</option>}
        {runs.map((r) => (
          <option key={r.id} value={r.id}>
            {when(r.startedAt)}{uiText(" UTC · ")}{uiValue(r.status)}
            {r.id === latest ? uiText(" · latest") : ''}
            {r.id === shown && loading ? uiText(" · loading") : ''}
          </option>
        ))}
      </select>
    </label>
  )
}

type TabId = 'evidence' | 'checks' | 'stability' | 'provenance'
/** Old section anchors (`#sec-ledger` ...) now live inside a tab. */
const ANCHOR_TAB: Record<string, TabId> = {
  'sec-ic': 'evidence',
  'sec-noise': 'evidence',
  'sec-quantiles': 'evidence',
  'sec-limits': 'evidence',
  'sec-headline': 'evidence',
  'sec-reasons': 'checks',
  'sec-ledger': 'checks',
  'sec-qualification': 'checks',
  'sec-folds': 'stability',
  'sec-horizons': 'stability',
  'sec-stability': 'stability',
  'sec-protocol': 'provenance',
  'sec-provenance': 'provenance',
  'sec-errors': 'provenance',
}
const TAB_IDS = ['evidence', 'checks', 'stability', 'provenance'] as const

type Loop = { outcome: LoopOutcome | null; onFinished: (o: LoopOutcome) => void; dismiss: () => void }

function LoopStatus({ loop, project }: { loop: Loop; project: ProjectSnapshot }) {
  return (
    <>
      <LoopProgress onFinished={loop.onFinished} />
      {loop.outcome && <LoopResult outcome={loop.outcome} project={project} onDismiss={loop.dismiss} />}
    </>
  )
}

function Content({ study, project, loadingRun, go, loop }: { study: FactorDiagnostics; project: ProjectSnapshot; loadingRun?: boolean; go: (href: string) => void; loop: Loop }) {
  const language = useLanguage()
  const tr = (en: string, zh: string) => translate(language, en, zh)
  const runRow: RunRow | undefined = project.runs.find((r) => r.id === study.run.id)
  const adjustment = adjustmentOf(project)
  const frontier = noiseFrontier(project.sessions, project.runs)
  const checks = buildChecks(study, frontier, project.sessions)
  const primary = study.horizonProfile.find((row) => row.horizon === study.protocol.primaryHorizon)
  const validation = study.summary.validation ?? primary?.validation
  const testVisible = studyTestVisible(study)
  const headlineSplits: HeadlineSplit[] = [
    ...(validation ? [{ name: 'Validation', role: 'selection split', summary: validation }] : []),
    ...(testVisible && study.summary.testAudit ? [{ name: 'Test', role: 'visible audit, not used for selection', summary: study.summary.testAudit }] : []),
  ]
  const failures = checks.filter((c) => c.state === 'fail').length
  const runIc = study.summary.validation?.meanRankIc ?? null
  const failing = !!runRow && ((runRow.errors ?? []).length > 0 || runRow.status !== 'succeeded')
  const [tab, selectTab, anchor] = useHashTab<TabId>(TAB_IDS, 'evidence', ANCHOR_TAB)
  useEffect(() => {
    if (anchor) requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ block: 'start' }))
  }, [anchor, tab])
  const tabs: TabDef<TabId>[] = [
    { id: 'evidence', label: uiText("Evidence") },
    { id: 'checks', label: uiText("Checks"), badge: failures > 0 ? `${failures} failing` : undefined },
    { id: 'stability', label: uiText("Stability") },
    { id: 'provenance', label: uiText("Provenance"), badge: failing ? 'run error' : undefined },
  ]
  const [paramsOpen, setParamsOpen] = useState(false)
  const adjP = adjustment?.statistics?.familywiseAdjustedPValue
  const stats: Stat[] = validation
    ? [
        { label: uiText("Rank IC"), value: num(validation.meanRankIc, 4), hint: uiTemplate("Validation split, {0}-bar horizon", [study.protocol.primaryHorizon]) },
        { label: uiText("HAC t"), value: num(validation.hacTStatistic, 2), hint: uiText("Validation split, HAC standard error") },
        ...(typeof adjP === 'number' && Number.isFinite(adjP)
          ? [{ label: uiText("Adj. p"), value: num(adjP, 3), hint: uiTemplate("Family-wise adjusted p over {0} unique trials, from the Session ledger (not a property of this Run alone)", [adjustment?.statistics?.uniqueTrials ?? '?']) }]
          : []),
      ]
    : []
  const duration = typeof runRow?.durationMs === 'number' ? `${(runRow.durationMs / 1000).toFixed(1)} s` : undefined
  // Which candidate this Run came from: the candidate source hash the Run publishes, and its trial number in the Session ledger (omitted when the ledger has no Experiment for this Run).
  const trialOfRun = project.sessions.flatMap((x) => x.experiments ?? []).find((e) => e.runId === study.run.id)?.sequence
  const sourceSha = study.run.sourceHash ? study.run.sourceHash.slice(0, 7) : null
  const candidateNote = `${sourceSha ? ` · ${uiText('Candidate')} ${sourceSha}` : ''}${trialOfRun !== undefined ? ` · ${uiText('Trial')} ${trialOfRun}` : ''}`
  const runState = runRow ? (runRow.status === 'succeeded' ? 'done' : 'failed') : null
  const exportButton: ActionButton = testVisible
    ? { label: uiText("Export JSON"), onClick: () => downloadJson(`${study.run.id}-factor-evidence.json`, study), title: uiText("Download the Factor evidence snapshot of this Run as JSON") }
    : { label: uiText("Export JSON"), disabled: true, disabledReason: uiTemplate("{0}: the raw snapshot is exported only when every number in it may be shown.", [TEST_HIDDEN_NOTE]) }
  const resultActions: ActionButton[] = [
    { label: uiText("Parameters"), onClick: () => setParamsOpen(true), title: uiText("Show the parameters fixed by the Study") },
    { label: uiText("Compare"), href: routeHref({ view: 'compare', id: project.id, a: study.run.id }) },
    { label: uiText("Open Project"), href: routeHref({ view: 'project', id: project.id }) },
    { label: uiText("Run summary"), href: routeHref({ view: 'run', id: project.id, run: study.run.id }) },
    exportButton,
  ]
  const metricGroups = [...coreGroups({ study, project, validation, testAudit: study.summary.testAudit, testVisible, defs: study.protocol.semantics }), ...(study.quantileEvidence.status === 'available' ? spreadGroups(study, testVisible) : [])]
  return (
    <WorkbenchShell
      ratio={40}
      left={<FactorEditor project={project} study={study} />}
      right={
        <PaneCard
          label={uiText("Factor evidence")}
          actions={
            <div className="wb-resultbar">
              <RunSelector project={project} shown={study.run.id} loading={!!loadingRun} go={go} />
              <StatChips label={uiText("Headline numbers of this Run")} scope="Validation" stats={stats} />
            </div>
          }
          status={
            <div className="fr-status">
              <ActionRow align="start" secondary={resultActions} />
              <LoopStatus loop={loop} project={project} />
              <FactorVerdict study={study} adjustment={adjustment} />
              {runState && runRow && (
                <StatusLine
                  state={runState}
                  text={uiTemplate("{0} · {1} UTC{2}", [runRow.status === 'succeeded' ? uiText('Run succeeded') : uiTemplate('Run {0}', [uiText(runRow.status)]), when(runRow.startedAt), candidateNote])}
                  elapsed={duration}
                />
              )}
            </div>
          }
        >
          <h1 className="sr-only">{uiText("Factor evidence ")}<span translate="no">{study.run.id}</span></h1>
          <FactorHero study={study} />
          {validation ? (
            <MetricGrid groups={metricGroups} hiddenNote={testVisible && study.summary.testAudit ? undefined : TEST_HIDDEN_NOTE} />
          ) : (
            <p className="muted small">{uiText("The Run published no validation summary.")}</p>
          )}
          <TrialCounter project={project} />

          <Tabs
            label={uiText("Factor evidence sections")}
            tabs={tabs}
            active={tab}
            onSelect={selectTab}
            panels={{
              evidence: (
                <>
                  <Section title={tr('Information coefficient over time', '信息系数随时间变化')} id="sec-ic" caption={testVisible ? tr('Per-timestamp rank IC; validation drives selection, test is a visible audit.', '逐时间点的秩 IC；验证集用于选择，测试集作为可见审计。') : tr('Per-timestamp rank IC; validation drives selection.', '逐时间点的秩 IC；验证集用于选择。')}>
                    <IcOverTime study={study} />
                  </Section>
                  <Section title={tr('Selection and noise', '选择与噪声')} id="sec-noise">
                    {frontier.ok ? <NoiseFrontierChart frontier={frontier.value} runIc={runIc} /> : <Empty title={uiText("Noise frontier")} reason={frontier.reason} />}
                    {frontier.ok && (
                      <p className="muted small">
                        {frontier.value.leaderRunId ? (
                          <>{uiText("Selected value: Run ")}<span className="mono" translate="no">{frontier.value.leaderRunId}</span>
                            {frontier.value.leaderRunId === study.run.id ? uiText(" (this Run).") : uiText("; this page shows a later Run that did not replace it.")}
                          </>
                        ) : (
                          'The selected value comes from the Session ledger; no single Run matches it exactly.'
                        )}
                      </p>
                    )}
                  </Section>
                  <Section title={tr('Quantile returns', '分组收益')} id="sec-quantiles">
                    <Quantiles study={study} />
                  </Section>
                  <Section title={tr('All headline figures', '全部核心指标')} id="sec-headline" caption={tr('Every published rank-IC figure for each shown split.', '各展示数据划分中已发布的全部秩 IC 指标。')}>
                    <HeadlineMetrics splits={headlineSplits} horizon={study.protocol.primaryHorizon} defs={study.protocol.semantics} />
                  </Section>
                  <Section title={tr('What these numbers do and do not show', '数字能说明什么、不能说明什么')} id="sec-limits" fold caption={tr("Scope and limits of this Run's evidence.", '本次运行证据的范围和限制。')}>
                    <Limits study={study} frontier={frontier} />
                  </Section>
                </>
              ),
              checks: (
                <>
                  <Section title={tr('Why this verdict', '判决原因')} id="sec-reasons" caption={tr('Every reason behind the verdict; the ? opens the field it reads.', '列出判决的各项原因；点击问号查看对应字段。')}>
                    <VerdictReasons study={study} adjustment={adjustment} />
                  </Section>
                  <Section title={tr('Check ledger', '检查记录')} id="sec-ledger">
                    <Ledger checks={checks} />
                  </Section>
                  <Section title={tr('Qualification diagnosis', '资格诊断')} id="sec-qualification">
                    <QualificationBlock study={study} />
                  </Section>
                </>
              ),
              stability: (
                <>
                  <Section title={tr('Chronological folds', '时间分折')} id="sec-folds">
                    <FoldTable study={study} />
                  </Section>
                  <Section title={tr('Horizon profile', '预测周期概览')} id="sec-horizons">
                    <HorizonTable study={study} />
                  </Section>
                  <Section title={tr('Stability: regime, asset, style', '稳定性：市场状态、资产与风格')} id="sec-stability" caption={tr('Per-split tables: market regime, asset and overlap with known styles.', '按数据划分展示市场状态、资产及与已知风格的重叠。')}>
                    <StabilityTables study={study} />
                  </Section>
                </>
              ),
              provenance: (
                <>
                  <Section title={tr('Protocol', '研究协议')} id="sec-protocol" caption={tr('Splits, horizons and the selection rules this Run was fixed under.', '本次运行固定的数据划分、预测周期和选择规则。')}>
                    <ProtocolBox study={study} />
                  </Section>
                  <Section title={tr('Provenance', '来源信息')} id="sec-provenance" caption={tr('Hashes, dataset and harness that produced this Run.', '产生本次运行的哈希、数据集和运行环境。')}>
                    <ProvenanceBox study={study} row={runRow} />
                  </Section>
                  <Section title={tr('Run errors', '运行错误')} id="sec-errors" caption={tr('Status and any errors the Run recorded.', '本次运行的状态和记录的错误。')}>
                    <RunErrors row={runRow} />
                  </Section>
                  <NotPublished />
                </>
              ),
            }}
          />
          <p className="muted small">
            <DiagnosticText value={study.warning} />{' '}
            <Info label={uiText("Why test is shown but not used for selection")} align="start">
              <p>{uiText("Validation drives selection; test is shown as a visible audit. The test split never enters selection (")}{study.protocol.testRole}{uiText("). Numbers from an external holdout are not drawn on this page.")}</p>
            </Info>
          </p>
          <FactsDialog open={paramsOpen} onClose={() => setParamsOpen(false)} title={uiText("Parameters fixed by the Study")} note={<>{uiText("Run ")}<span className="mono" translate="no">{study.run.id}</span>{uiText(". Read-only: the Study fixes them so results stay comparable.")}</>} facts={lockedFacts(study)} />
        </PaneCard>
      }
    />
  )
}

type Loaded = { key: string; study: FactorDiagnostics | null; error: string | null }

export function FactorPage({ project, study, run, go }: { project: ProjectSnapshot; study?: string; run?: string; go?: (href: string, options?: { replace?: boolean }) => void }) {
  const language = useLanguage()
  const tr = (en: string, zh: string) => translate(language, en, zh)
  const navigate = go ?? ((href: string, options?: { replace?: boolean }) => (options?.replace ? window.location.replace(href) : window.location.assign(href)))
  const inline = project.factorExplorer
  const wanted = run && run !== inline?.run.id ? run : null
  // /api/v1/run serves Factor Runs only; a Run of another lane belongs on that lane's page.
  const other = wanted ? otherLaneOf(project, wanted) : null
  const fetchId = other ? null : wanted
  const otherHref = other ? routeHref({ view: other.view, id: project.id }) : null
  useEffect(() => {
    if (otherHref) navigate(otherHref, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherHref])
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const { hideDock } = useActions()
  const [outcome, setOutcome] = useState<LoopOutcome | null>(null)
  useEffect(() => {
    // Progress is drawn inline on this page, so the floating job dock stays hidden while it is open.
    hideDock(true)
    return () => hideDock(false)
  }, [hideDock])
  const loop: Loop = {
    outcome,
    dismiss: () => setOutcome(null),
    onFinished: (done) => {
      setOutcome(done)
      // A finished evaluation wrote a new Run (KEEP, REVERT or CRASH alike): show it, from the top, without a reload.
      if (done.status === 'succeeded' && done.actionId === 'experiment.evaluate' && done.runId) {
        navigate(routeHref({ view: 'factor', id: project.id, run: done.runId }))
        window.scrollTo(0, 0)
        document.querySelectorAll('.wb-pane-body, .fe-scroll').forEach((el) => el.scrollTo(0, 0))
      }
    },
  }
  const key = wanted ? `${project.id}/${wanted}` : ''

  useEffect(() => {
    if (!fetchId) return
    const controller = new AbortController()
    getJson<{ factorExplorer: FactorDiagnostics | null }>(
      `/api/v1/run?${new URLSearchParams({ project: project.id, id: fetchId })}`,
      controller.signal,
    )
      .then((body) => setLoaded({ key, study: body.factorExplorer, error: body.factorExplorer ? null : 'The server returned no Factor evidence for this Run.' }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoaded({ key, study: null, error: error instanceof Error ? error.message : String(error) })
      })
    return () => controller.abort()
  }, [project.id, fetchId, key])

  const fetched = wanted && loaded?.key === key ? loaded : null
  const explorer = wanted ? fetched?.study ?? null : inline
  const mismatch = explorer && study && explorer.run.studyId !== study
  const pending = !!fetchId && !fetched
  if (explorer && !mismatch) return <Content study={explorer} project={project} loadingRun={pending} go={navigate} loop={loop} />
  return (
    <div className="pg">
      <header className="pg-head">
        <h1>{tr('Factor evidence', '因子证据')}</h1>
      </header>
      <RunSelector project={project} shown={wanted ?? inline?.run.id ?? ''} loading={pending} go={navigate} />
      <LoopStatus loop={loop} project={project} />
      {other && otherHref ? (
        <p className="muted">{uiText("This Run belongs to the ")}{other.lane}{uiText(" lane. ")}<a href={otherHref}>{uiText("Open ")}{other.lane}</a>
        </p>
      ) : pending ? (
        <p className="muted">{tr('Loading Run…', '正在加载运行记录…')}</p>
      ) : fetched?.error ? (
        <Notice kind="error" label={uiText("Error")} title={uiTemplate("Could not load Run {0}.", [wanted])} subtitle={fetched.error} />
      ) : (
        <Notice
          kind="info"
          label={uiText("Info")}
          title={mismatch ? uiTemplate("No verified Factor Run for Study {0}.", [study]) : uiText("This Project has no verified Factor Run.")}
          subtitle={
            mismatch
              ? uiTemplate("The shown Factor Run belongs to Study {0}.", [explorer.run.studyId])
              : uiText("Run the Factor Study with aq run, then reload.")
          }
        />
      )}
      <p>
        <a href={routeHref({ view: 'project', id: project.id })}>{tr('Back to Project', '返回项目')}</a>
      </p>
    </div>
  )
}
