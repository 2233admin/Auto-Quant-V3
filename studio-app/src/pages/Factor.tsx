import { useEffect, useState, type ReactNode } from 'react'
import { getJson, type FactorDiagnostics, type ProjectSnapshot, type RunRow } from '../api'
import { Glyph } from '../design/icons'
import { num, plural, when } from '../format'
import { Section } from '../design/layout'
import { Notice } from '../Notice'
import { routeHref } from '../route'
import { IcByHorizon, IcOverTime, Empty, NoiseFrontierChart, Quantiles } from './FactorCharts'
import { noiseFrontier, SPLITS, type FrontierResult } from './factorMath'
import { FoldTable, HorizonTable, ProtocolBox, ProvenanceBox, QualificationBlock, RunErrors, StabilityTables, VerdictHero, VerdictReasons } from './FactorEvidence'
import { adjustmentOf, CoreTiles, TestedFacts, Tabs, useHashTab, type TabDef } from './FactorWorkbench'
import { RunAnalysisButton } from '../actions/RunAnalysisButton'
import { ResultHeader } from './ResultHeader'
import { otherLaneOf } from './run/runTypes'
import { Info } from '../components/Info'
import { HeadlineMetrics, type HeadlineSplit } from '../components/HeadlineMetrics'
import { NotPublished } from '../components/NotPublished'
import { TrialCounter } from '../components/TrialCounter'
import './factor.css'

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
  const insufficient = profile.flatMap((row) => SPLITS.filter((s) => !row[s].sufficient).map((s) => `${row.horizon}-bar ${s}`))
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
      label: 'Selection uses the validation split only',
      detail: `Selection split ${protocol.selectionSplit}; test enters selection: ${protocol.testEntersSelection ? 'yes' : 'no'}.`,
    },
    {
      id: 'test-role',
      group: 'Research integrity',
      state: 'info',
      label: 'Test split is a visible diagnostic',
      detail: `Test role ${protocol.testRole}. ${
        integrity?.externalHoldoutRequired
          ? 'The Session ledger requires a new external holdout before a fresh production-grade claim.'
          : 'No Session ledger says whether an external holdout is required.'
      }`,
    },
    {
      id: 'split-method',
      group: 'Split protocol',
      state: protocol.splits.candidateDependent === false ? 'pass' : 'fail',
      label: 'Split boundaries do not depend on the candidate',
      detail: <>Method <span className="mono">{protocol.splits.method}</span>; candidate dependent: {protocol.splits.candidateDependent ? 'yes' : 'no'}.</>,
    },
    {
      id: 'split-order',
      group: 'Split protocol',
      state: ordered ? 'pass' : 'fail',
      label: 'Train, validation and test are chronological and disjoint',
      detail: `Train to ${day(windows.train.end)}, validation ${day(windows.validation.start)} to ${day(windows.validation.end)}, test from ${day(windows.test.start)}.`,
    },
    {
      id: 'purge',
      group: 'Split protocol',
      state: protocol.splits.targetCrossesBoundary === false ? 'pass' : 'fail',
      label: 'Forward targets do not cross a split boundary',
      detail: `Boundary rows purged before validation: ${purged}.`,
    },
    {
      id: 'sufficient',
      group: 'Split protocol',
      state: insufficient.length === 0 ? 'pass' : 'fail',
      label: 'Every horizon and split meets its minimum observation count',
      detail: insufficient.length === 0 ? `${plural(profile.length * SPLITS.length, 'cell')} checked.` : `Below minimum: ${insufficient.join(', ')}.`,
    },
    causality?.available
      ? {
          id: 'causality',
          group: 'Causality audit',
          state: 'pass',
          label: 'Factor values at each timestamp use only data up to that timestamp',
          detail: (
            <>
              Audit <span className="mono">{causality.audit}</span> at {plural(causality.cuts?.length ?? 0, 'cut')}; cross-asset context{' '}
              <span className="mono">{causality.crossAssetContext ?? 'not recorded'}</span>.
            </>
          ),
        }
      : {
          id: 'causality',
          group: 'Causality audit',
          state: 'info',
          label: 'Causality audit',
          detail: causality ? `Not recorded for this Run (${causality.reason}).` : 'This server does not send the causality audit; restart it on the current build.',
        },
    {
      id: 'validation-t',
      group: 'Evidence',
      state: tStat === null ? 'info' : Math.abs(tStat) >= 1.96 && (primary?.meanRankIc ?? 0) > 0 ? 'pass' : 'fail',
      label: `Validation ${protocol.primaryHorizon}-bar mean IC is positive with HAC |t| ≥ 1.96`,
      detail: primary ? `Mean IC ${num(primary.meanRankIc, 4)}, HAC t ${num(tStat, 2)}, p ${num(primary.hacNormalPValue, 3)}, ${int(primary.observations)} observations.` : 'No validation summary.',
    },
    frontier.ok && frontier.value.passes !== null
      ? {
          id: 'familywise',
          group: 'Evidence',
          state: frontier.value.passes ? 'pass' : 'fail',
          label: 'Selected IC survives the family-wise HAC rule',
          detail: `Raw p ${num(frontier.value.rawP, 3)} × ${frontier.value.trials} trials = adjusted p ${num(frontier.value.adjustedP, 3)}; the rule needs ≤ 0.05.`,
        }
      : {
          id: 'familywise',
          group: 'Evidence',
          state: 'info',
          label: 'Selected IC survives the family-wise HAC rule',
          detail: frontier.ok ? 'The ledger publishes no verdict.' : frontier.reason,
        },
    {
      id: 'qualification',
      group: 'Evidence',
      state: qualification.diagnosis ? (qualification.diagnosis.qualifiesForPortfolio ? 'pass' : 'fail') : 'info',
      label: 'Factor qualifies for portfolio research',
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
            <th scope="col">Check</th>
            <th scope="col">Result</th>
            <th scope="col">Basis</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((c) => (
            <tr key={c.id}>
              <th scope="row">
                {c.label}
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
          <h3 className="h-small">What the numbers show</h3>
          <ul className="bullets">
            <li>
              How well the factor ranks next-{study.protocol.primaryHorizon}-bar returns <em>over time</em> for{' '}
              <span className="mono" translate="no">{assets.join(', ') || 'the prediction asset'}</span>, split into train, validation and test windows.
            </li>
            <li>
              Whether each split's mean IC is distinguishable from zero, using a HAC standard error whose maximum lag equals the forward horizon.
            </li>
            <li>The selection-adjusted view for the trials the Project ledger records.</li>
          </ul>
        </div>
        <div>
          <h3 className="h-small">What they do not show</h3>
          <ul className="bullets">
            <li>
              Cross-sectional ranking skill. The evaluation mode is <span className="mono">{mode}</span>: one asset scored through time, so there is
              no population to rank and no quantile groups.
            </li>
            <li>
              Independence of trials.{' '}
              {trials === null
                ? 'No trial ledger is available, so the number of tried candidates is unknown.'
                : `N = ${trials} is an upper bound counted from unique candidate sources; ideas tried outside this Project are not counted.`}
            </li>
            <li>
              Overlap-free samples. Forward returns overlap, so observations are not independent; the HAC lag corrects the standard error, not the
              sample size.
            </li>
            <li>Tradable performance. Costs, capacity and execution are outside this Run, and its trading authority is none.</li>
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
      <span className="sr-only">Factor Run</span>
      <select
        value={runs.some((r) => r.id === shown) ? shown : ''}
        onChange={(event) => go(routeHref({ view: 'factor', id: project.id, run: event.target.value }))}
      >
        {!runs.some((r) => r.id === shown) && <option value="">Choose a Run…</option>}
        {runs.map((r) => (
          <option key={r.id} value={r.id}>
            {when(r.startedAt)} UTC · {r.primaryMetric} {num(r.primaryValue, 4)} · {r.status}
            {r.id === latest ? ' · latest' : ''}
            {r.id === shown && loading ? ' · loading' : ''}
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

function Content({ study, project, loadingRun, go }: { study: FactorDiagnostics; project: ProjectSnapshot; loadingRun?: boolean; go: (href: string) => void }) {
  const runRow: RunRow | undefined = project.runs.find((r) => r.id === study.run.id)
  const adjustment = adjustmentOf(project)
  const frontier = noiseFrontier(project.sessions, project.runs)
  const checks = buildChecks(study, frontier, project.sessions)
  const primary = study.horizonProfile.find((row) => row.horizon === study.protocol.primaryHorizon)
  const validation = study.summary.validation ?? primary?.validation
  const testVisible = !!study.summary.testAudit && study.protocol.testRole === 'visible-diagnostic'
  const headlineSplits: HeadlineSplit[] = [
    ...(validation ? [{ name: 'Validation', role: 'selection split', summary: validation }] : []),
    ...(study.summary.testAudit ? [{ name: 'Test', role: 'visible audit, not used for selection', summary: study.summary.testAudit }] : []),
  ]
  const failures = checks.filter((c) => c.state === 'fail').length
  const runIc = study.summary.validation?.meanRankIc ?? null
  const failing = !!runRow && ((runRow.errors ?? []).length > 0 || runRow.status !== 'succeeded')
  const [tab, selectTab, anchor] = useHashTab<TabId>(TAB_IDS, 'evidence', ANCHOR_TAB)
  useEffect(() => {
    if (anchor) requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ block: 'start' }))
  }, [anchor, tab])
  const tabs: TabDef<TabId>[] = [
    { id: 'evidence', label: 'Evidence' },
    { id: 'checks', label: 'Checks', badge: failures > 0 ? `${failures} failing` : undefined },
    { id: 'stability', label: 'Stability' },
    { id: 'provenance', label: 'Provenance', badge: failing ? 'run error' : undefined },
  ]
  return (
    <div className="wb">
      <aside className="wb-side" aria-label="What was tested">
        <div className="wb-head">
          <h1 className="wb-title">Factor evidence</h1>
          <span className="wb-sub mono" translate="no">{study.run.id}</span>
        </div>
        <section aria-labelledby="wb-tested">
          <h2 className="wb-h" id="wb-tested">What was tested</h2>
          <TestedFacts study={study} />
        </section>
      </aside>

      <div className="wb-main">
        <ResultHeader
          select={<RunSelector project={project} shown={study.run.id} loading={!!loadingRun} go={go} />}
          action={<RunAnalysisButton project={project} preferStudyId={study.run.studyId} />}
          links={
            <>
              <a href={routeHref({ view: 'compare', id: project.id, a: study.run.id })}>Compare</a>
              <a href={routeHref({ view: 'project', id: project.id })}>Open Project</a>
              <a href={routeHref({ view: 'run', id: project.id, run: study.run.id })}>Run summary</a>
            </>
          }
        />
        <VerdictHero study={study} adjustment={adjustment} />
        <div className="wb-hero">
          <IcByHorizon study={study} hero />
        </div>
        <CoreTiles study={study} project={project} validation={validation} testAudit={study.summary.testAudit} testVisible={testVisible} defs={study.protocol.semantics} />
        <TrialCounter project={project} />

        <Tabs
          label="Factor evidence sections"
          tabs={tabs}
          active={tab}
          onSelect={selectTab}
          panels={{
            evidence: (
              <>
                <Section title="Information coefficient over time" id="sec-ic" caption="Per-timestamp rank IC; validation drives selection, test is a visible audit.">
                  <IcOverTime study={study} />
                </Section>
                <Section title="Selection and noise" id="sec-noise">
                  {frontier.ok ? <NoiseFrontierChart frontier={frontier.value} runIc={runIc} /> : <Empty title="Noise frontier" reason={frontier.reason} />}
                  {frontier.ok && (
                    <p className="muted small">
                      {frontier.value.leaderRunId ? (
                        <>
                          Selected value: Run <span className="mono" translate="no">{frontier.value.leaderRunId}</span>
                          {frontier.value.leaderRunId === study.run.id ? ' (this Run).' : '; this page shows a later Run that did not replace it.'}
                        </>
                      ) : (
                        'The selected value comes from the Session ledger; no single Run matches it exactly.'
                      )}
                    </p>
                  )}
                </Section>
                <Section title="Quantile returns" id="sec-quantiles">
                  <Quantiles study={study} />
                </Section>
                <Section title="All headline figures" id="sec-headline" caption="Every published rank-IC figure for each shown split.">
                  <HeadlineMetrics splits={headlineSplits} horizon={study.protocol.primaryHorizon} defs={study.protocol.semantics} />
                </Section>
                <Section title="What these numbers do and do not show" id="sec-limits" fold caption="Scope and limits of this Run's evidence.">
                  <Limits study={study} frontier={frontier} />
                </Section>
              </>
            ),
            checks: (
              <>
                <Section title="Why this verdict" id="sec-reasons" caption="Every reason behind the verdict; the ? opens the field it reads.">
                  <VerdictReasons study={study} adjustment={adjustment} />
                </Section>
                <Section title="Check ledger" id="sec-ledger">
                  <Ledger checks={checks} />
                </Section>
                <Section title="Qualification diagnosis" id="sec-qualification">
                  <QualificationBlock study={study} />
                </Section>
              </>
            ),
            stability: (
              <>
                <Section title="Chronological folds" id="sec-folds">
                  <FoldTable study={study} />
                </Section>
                <Section title="Horizon profile" id="sec-horizons">
                  <HorizonTable study={study} />
                </Section>
                <Section title="Stability: regime, asset, style" id="sec-stability" caption="Per-split tables: market regime, asset and overlap with known styles.">
                  <StabilityTables study={study} />
                </Section>
              </>
            ),
            provenance: (
              <>
                <Section title="Protocol" id="sec-protocol" caption="Splits, horizons and the selection rules this Run was fixed under.">
                  <ProtocolBox study={study} />
                </Section>
                <Section title="Provenance" id="sec-provenance" caption="Hashes, dataset and harness that produced this Run.">
                  <ProvenanceBox study={study} row={runRow} />
                </Section>
                <Section title="Run errors" id="sec-errors" caption="Status and any errors the Run recorded.">
                  <RunErrors row={runRow} />
                </Section>
                <NotPublished />
              </>
            ),
          }}
        />
        <p className="muted small">
          {study.warning}{' '}
          <Info label="Why test is shown but not used for selection" align="start">
            <p>
              Validation drives selection; test is shown as a visible audit. The test split never enters selection ({study.protocol.testRole}). Numbers from an
              external holdout are not drawn on this page.
            </p>
          </Info>
        </p>
      </div>
    </div>
  )
}

type Loaded = { key: string; study: FactorDiagnostics | null; error: string | null }

export function FactorPage({ project, study, run, go }: { project: ProjectSnapshot; study?: string; run?: string; go?: (href: string, options?: { replace?: boolean }) => void }) {
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
  return (
    <div className="pg">
      {explorer && !mismatch ? (
        <Content study={explorer} project={project} loadingRun={pending} go={navigate} />
      ) : (
        <>
          <header className="pg-head">
            <h1>Factor evidence</h1>
          </header>
          <RunSelector project={project} shown={wanted ?? inline?.run.id ?? ''} loading={pending} go={navigate} />
          {other && otherHref ? (
            <p className="muted">
              This Run belongs to the {other.lane} lane. <a href={otherHref}>Open {other.lane}</a>
            </p>
          ) : pending ? (
            <p className="muted">Loading Run…</p>
          ) : fetched?.error ? (
            <Notice kind="error" label="Error" title={`Could not load Run ${wanted}.`} subtitle={fetched.error} />
          ) : (
            <Notice
              kind="info"
              label="Info"
              title={mismatch ? `No verified Factor Run for Study ${study}.` : 'This Project has no verified Factor Run.'}
              subtitle={
                mismatch
                  ? `The shown Factor Run belongs to Study ${explorer.run.studyId}.`
                  : 'Run the Factor Study with aq run, then reload.'
              }
            />
          )}
          <p>
            <a href={routeHref({ view: 'project', id: project.id })}>Back to Project</a>
          </p>
        </>
      )}
    </div>
  )
}
