import { uiTemplate, uiText, uiValue } from '../../i18n'
import type { ProjectSnapshot } from '../../api'
import { num, when } from '../../format'
import { Section } from '../../design/layout'
import { Info } from '../../components/Info'
import { Notice } from '../../Notice'
import { routeHref } from '../../route'
import { RunSelect } from '../run/RunSelect'
import { otherLaneOf, short, type RunDiagnostics } from '../run/runTypes'
import { useRun } from '../run/useRun'
import { compareBasis, deltaWord, metricRows, provenanceSentences, type Basis } from './basis'
import '../run/run.css'
import './compare.css'

function signed(d: number, digits: number): string {
  return `${d > 0 ? '+' : ''}${d.toFixed(digits)}`
}

function BasisBanner({ basis }: { basis: Basis }) {
  const differing = basis.checks.filter((c) => c.state === 'different')
  const noHash = basis.missing.length > 0
  return (
    <div className={`basis ${basis.locked ? 'basis--locked' : 'basis--open'}`} role="status">
      <div className="basis-title">
        {noHash
          ? uiText("Basis not comparable: no hash in payload")
          : basis.locked
            ? uiText("Basis locked: both Runs share the same dataset hash and research horizon.")
            : uiTemplate('Basis not locked: the two Runs do not share the same {0}.', [[basis.checks[0].state === 'different' ? uiText('dataset hash') : null, basis.checks[1].state === 'different' ? uiText('horizon hash') : null].filter(Boolean).join(uiText(' or '))])}
      </div>
      {noHash && <p className="small">{uiText("Missing: ")}{basis.missing.join('; ')}.</p>}
      {differing.length > 0 && !noHash && (
        <p className="small">{uiText("Differs: ")}{differing.map((c) => c.label).join(', ')}.</p>
      )}
    </div>
  )
}

function Table({ a, b, project }: { a: RunDiagnostics; b: RunDiagnostics; project: ProjectSnapshot }) {
  const rows = metricRows(a, b)
  const basis = compareBasis(a, b)
  return (
    <>
      <div className="pin">
        <BasisBanner basis={basis} />
      </div>
      <div className="cols cols--3-2">
        <Section title={uiText("Before and after")} id="cmp-table" caption={uiText("Run A is before, Run B is after. Delta is B minus A. Selection uses the validation split only.")}>
          <div className="tablewrap">
            <table className="tbl cmp">
              <thead>
                <tr>
                  <th scope="col">{uiText("Measure")}</th>
                  <th scope="col" className="r">{uiText("Run A (before)")}</th>
                  <th scope="col" className="r">{uiText("Run B (after)")}</th>
                  <th scope="col" className="r">{uiText("Delta (B - A)")}</th>
                  <th scope="col">{uiText("Reading")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{uiValue(row.label)}</th>
                    <td className="r num">{num(row.a, row.digits)}</td>
                    <td className="r num">{num(row.b, row.digits)}</td>
                    <td className="r num">{row.a !== null && row.b !== null ? signed(row.b - row.a, row.digits) : '—'}</td>
                    <td className="small muted">{deltaWord(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.some((r) => r.group === 'test') && <p className="small muted">{uiText("Test split hidden until its audit exists (at least one Run has no visible test audit).")}</p>}
        </Section>
        <div className="vstack">
          <Section
            title={uiTemplate("Comparison mode: {0}", [basis.mode.name])}
            id="cmp-mode"
            caption={
              <>{uiText("How the two Runs relate.")}{' '}
                <Info label={uiText("What this comparison mode means")}>
                  <p>{basis.mode.meaning}</p>
                </Info>
              </>
            }
          >
            <ul className="plain small">
              {provenanceSentences(a, b, project).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </Section>
          <Section title={uiText("Basis fields")} id="cmp-basis" caption={uiText("What each Run records for the dataset, horizon and window.")}>
            <div className="tablewrap">
              <table className="tbl cmp">
                <thead>
                  <tr>
                    <th scope="col">{uiText("Field")}</th>
                    <th scope="col">{uiText("Run A")}</th>
                    <th scope="col">{uiText("Run B")}</th>
                    <th scope="col">{uiText("State")}</th>
                  </tr>
                </thead>
                <tbody>
                  {basis.checks.map((c) => (
                    <tr key={c.key}>
                      <th scope="row">{uiValue(c.label)}</th>
                      <td className="mono small">{c.key === 'window' ? c.a ?? uiText("not in payload") : c.a ? (c.a.length > 40 ? short(c.a, 16) : c.a) : uiText("not in payload")}</td>
                      <td className="mono small">{c.key === 'window' ? c.b ?? uiText("not in payload") : c.b ? (c.b.length > 40 ? short(c.b, 16) : c.b) : uiText("not in payload")}</td>
                      <td>{c.state === 'same' ? uiText("Same") : c.state === 'different' ? uiText("Different") : uiText("Missing")}</td>
                    </tr>
                  ))}
                  <tr>
                    <th scope="row">{uiText("Started (UTC)")}</th>
                    <td className="mono small">{when(a.run.startedAt)}</td>
                    <td className="mono small">{when(b.run.startedAt)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      </div>
    </>
  )
}

/** Two Runs of one Project side by side, with a delta column and an honest basis check. */
export function ComparePage({ project, a, b, go }: { project: ProjectSnapshot; a?: string; b?: string; go: (href: string) => void }) {
  const laneA = a ? otherLaneOf(project, a) : null
  const laneB = b ? otherLaneOf(project, b) : null
  const factorRuns = project.runs.filter((r) => !otherLaneOf(project, r.id))
  // /api/v1/run serves Factor Runs only: a Run of another lane is never fetched.
  const loadA = useRun(project.id, laneA ? undefined : a)
  const loadB = useRun(project.id, laneB ? undefined : b)
  const set = (next: { a?: string; b?: string }) => go(routeHref({ view: 'compare', id: project.id, a: next.a ?? a, b: next.b ?? b }))
  const error = loadA.state === 'error' ? loadA : loadB.state === 'error' ? loadB : null
  const other = laneA ?? laneB
  return (
    <div className="pg">
      <header className="pg-head cmp-head">
        <div className="cmp-title">
          <h1>{uiText("Compare two Runs")}</h1>
          <p className="muted small">{uiText("Read-only. Both Runs come from the same Project and are verified by the server before they are shown.")}</p>
        </div>
        <div className="cmp-pick">
          <RunSelect bar label={uiText("Run A (before)")} runs={factorRuns} value={a} onChange={(id) => set({ a: id })} />
          <RunSelect bar label={uiText("Run B (after)")} runs={factorRuns} value={b} onChange={(id) => set({ b: id })} />
        </div>
      </header>
      {!a || !b ? <p className="muted">{uiText("Choose a Run A and a Run B to compare.")}</p> : null}
      {other && (
        <Notice
          kind="info"
          label={uiText("Info")}
          title={uiTemplate("A {0} Run cannot be compared here.", [other.lane])}
          subtitle={uiText("Compare reads Factor Runs only. Open that Run from its own lane page.")}
        />
      )}
      {error && !error.unsupported && <Notice kind="error" label={uiText("Error")} title={uiText("Could not load a Run.")} subtitle={error.message} />}
      {error?.unsupported && <Notice kind="info" label={uiText("Info")} title={uiText("One of these Runs is not a Factor Run.")} subtitle={uiText("Compare reads Factor Runs only.")} />}
      {(loadA.state === 'loading' || loadB.state === 'loading') && <p className="muted">{uiText("Loading Runs…")}</p>}
      {loadA.state === 'ready' && loadB.state === 'ready' && <Table a={loadA.payload.factorExplorer} b={loadB.payload.factorExplorer} project={project} />}
    </div>
  )
}
