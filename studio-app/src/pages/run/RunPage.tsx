import type { ReactNode } from 'react'
import type { ProjectSnapshot, RankSummary } from '../../api'
import { num, plural, when } from '../../format'
import { Notice } from '../../Notice'
import { routeHref } from '../../route'
import { RunList } from './RunList'
import { RunSelect } from './RunSelect'
import { short, testAuditVisible, type RunDiagnostics } from './runTypes'
import { useRun } from './useRun'
import './run.css'

function Section({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  return (
    <section className="sec" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  )
}

const day = (iso: string | undefined) => (iso ? iso.slice(0, 10) : '—')

function Headline({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="headline">
      <dt>{label}</dt>
      <dd>{value}</dd>
      <span className="faint small">{note}</span>
    </div>
  )
}

function SplitRow({ name, role, s }: { name: string; role: string; s: RankSummary | undefined }) {
  return (
    <tr>
      <th scope="row">{name}<span className="faint small">{role}</span></th>
      <td className="r num">{num(s?.meanRankIc, 4)}</td>
      <td className="r num">{num(s?.rankIcir, 3)}</td>
      <td className="r num">{num(s?.hacTStatistic, 2)}</td>
      <td className="r num">{num(s?.hacNormalPValue, 3)}</td>
      <td className="r num">{num(s?.rankHitRate, 3)}</td>
      <td className="r num">{s ? s.observations.toLocaleString('en-US') : '—'}</td>
    </tr>
  )
}

function Body({ fe, project }: { fe: RunDiagnostics; project: ProjectSnapshot }) {
  const v = fe.summary.validation
  const showTest = testAuditVisible(fe)
  const windows = fe.protocol.splits.splits
  const row = project.runs.find((r) => r.id === fe.run.id)
  return (
    <>
      <Section title="Headline" id="run-headline">
        <p className="small muted">
          Selection uses the validation split only. The primary horizon is {fe.protocol.primaryHorizon} bars. {fe.run.summary}
        </p>
        <dl className="headlines">
          <Headline label="Validation mean rank IC" value={num(v?.meanRankIc, 4)} note={`${fe.protocol.primaryHorizon}-bar horizon`} />
          <Headline label="HAC t-statistic" value={num(v?.hacTStatistic, 2)} note={`p = ${num(v?.hacNormalPValue, 3)}`} />
          <Headline label="IC information ratio" value={num(v?.rankIcir, 3)} note={`hit rate ${num(v?.rankHitRate, 3)}`} />
          <Headline label="Observations" value={v ? v.observations.toLocaleString('en-US') : '—'} note={v?.sufficient === false ? 'below the minimum' : 'validation split'} />
        </dl>
      </Section>

      <Section title="By split" id="run-splits">
        <div className="tablewrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Split</th>
                <th scope="col" className="r">Mean rank IC</th>
                <th scope="col" className="r">IC IR</th>
                <th scope="col" className="r">HAC t</th>
                <th scope="col" className="r">p</th>
                <th scope="col" className="r">Hit rate</th>
                <th scope="col" className="r">Obs.</th>
              </tr>
            </thead>
            <tbody>
              <SplitRow name={`Validation (${day(windows.validation.start)} to ${day(windows.validation.end)})`} role="selection split" s={v} />
              {showTest && <SplitRow name={`Test (${day(windows.test.start)} to ${day(windows.test.end)})`} role="visible audit, not used for selection" s={fe.summary.testAudit} />}
            </tbody>
          </table>
        </div>
        {!showTest && <p className="small muted">The test split is not drawn: this Run's protocol does not mark it as a visible diagnostic.</p>}
      </Section>

      <Section title="Horizon profile (validation)" id="run-horizons">
        <div className="tablewrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Horizon (bars)</th>
                <th scope="col" className="r">Mean rank IC</th>
                <th scope="col" className="r">HAC t</th>
                <th scope="col" className="r">p</th>
                <th scope="col" className="r">Obs.</th>
              </tr>
            </thead>
            <tbody>
              {fe.horizonProfile.map((h) => (
                <tr key={h.horizon}>
                  <th scope="row">{h.horizon}{h.horizon === fe.protocol.primaryHorizon && <span className="faint small">primary</span>}</th>
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

      {fe.factorQualification.diagnosis && (
        <Section title="Qualification diagnosis" id="run-qualification">
          <p>
            <strong>{fe.factorQualification.diagnosis.stage}</strong>: {fe.factorQualification.diagnosis.explanation}
          </p>
        </Section>
      )}

      <Section title="Provenance" id="run-provenance">
        <dl className="kv">
          <dt>Run</dt><dd className="mono">{fe.run.id}</dd>
          <dt>Status</dt><dd>{fe.run.status ?? row?.status ?? '—'}</dd>
          <dt>Started / completed (UTC)</dt><dd className="mono">{when(fe.run.startedAt)} / {when(fe.run.completedAt)}</dd>
          <dt>Study</dt><dd className="mono">{fe.run.studyId}</dd>
          <dt>Candidate source hash</dt><dd className="mono" title={fe.run.sourceHash}>{short(fe.run.sourceHash, 16)}</dd>
          <dt>Study hash</dt><dd className="mono" title={fe.run.studyHash}>{short(fe.run.studyHash, 16)}</dd>
          <dt>Input hash</dt><dd className="mono" title={fe.run.inputHash}>{short(fe.run.inputHash, 16)}</dd>
          <dt>Dataset</dt><dd className="mono">{fe.dataset.id} {fe.dataset.version}</dd>
          <dt>Dataset hash</dt><dd className="mono" title={fe.dataset.hash}>{short(fe.dataset.hash, 16)}</dd>
          <dt>Dataset window</dt><dd className="mono">{day(fe.dataset.timeRange?.start)} to {day(fe.dataset.timeRange?.end)}</dd>
          <dt>Universe</dt><dd>{fe.dataset.universe.join(', ')}</dd>
          <dt>Prediction assets</dt><dd>{(fe.predictionUniverse.predictionAssets ?? []).join(', ') || '—'}</dd>
          <dt>Research horizon id</dt><dd className="mono">{fe.researchHorizon?.id ?? '—'}</dd>
          <dt>Harness</dt><dd className="mono">{fe.harness ? `${fe.harness.id ?? ''} ${fe.harness.version ?? ''}${fe.harness.dirty ? ' (dirty)' : ''}` : '—'}</dd>
        </dl>
      </Section>
      {fe.warning && <p className="small muted">{fe.warning}</p>}
    </>
  )
}

/** One Run of a Project, loaded from the read-only /api/v1/run route. Works for any Run, not only the latest. */
export function RunPage({ project, runId, go }: { project: ProjectSnapshot; runId: string; go: (href: string) => void }) {
  const load = useRun(project.id, runId)
  const study = project.runs.find((r) => r.id === runId)?.studyId
  const factorHref = routeHref({ view: 'factor', id: project.id, run: runId, ...(study ? { study } : {}) })
  return (
    <div className="pg">
      <header className="pg-head">
        <h1>Run <span className="mono" translate="no">{runId.replace(/^run-/, '')}</span></h1>
        <p className="muted small">
          {plural(project.runs.length, 'Run')} in this Project.{' '}
          <a href={factorHref}>Open the full Factor evidence for this Run</a>
          {' · '}
          <a href={routeHref({ view: 'compare', id: project.id, a: runId })}>Compare with another Run</a>
        </p>
        <RunSelect label="Run" runs={project.runs} value={runId} onChange={(id) => go(routeHref({ view: 'run', id: project.id, run: id }))} />
      </header>
      {load.state === 'loading' && <p className="muted">Loading Run…</p>}
      {load.state === 'error' && <Notice kind="error" label="Error" title="Could not load this Run." subtitle={load.message} />}
      {load.state === 'ready' && <Body fe={load.payload.factorExplorer} project={project} />}
      <section className="sec" aria-labelledby="run-all">
        <h2 id="run-all">All Runs of this Project</h2>
        <RunList project={project} />
      </section>
    </div>
  )
}
