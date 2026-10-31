import type { ProjectSnapshot } from '../../api'
import { num, when } from '../../format'
import { Section } from '../../design/layout'
import { Info } from '../../components/Info'
import { Notice } from '../../Notice'
import { routeHref } from '../../route'
import { RunSelect } from '../run/RunSelect'
import { short, type RunDiagnostics } from '../run/runTypes'
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
          ? 'Basis not comparable: no hash in payload'
          : basis.locked
            ? 'Basis locked: both Runs share the same dataset hash and research horizon.'
            : 'Basis not locked: the two Runs do not share the same ' + [basis.checks[0].state === 'different' ? 'dataset hash' : null, basis.checks[1].state === 'different' ? 'horizon hash' : null].filter(Boolean).join(' or ') + '.'}
      </div>
      {noHash && <p className="small">Missing: {basis.missing.join('; ')}.</p>}
      {differing.length > 0 && !noHash && (
        <p className="small">Differs: {differing.map((c) => c.label).join(', ')}.</p>
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
        <Section title="Before and after" id="cmp-table" caption="Run A is before, Run B is after. Delta is B minus A. Selection uses the validation split only.">
          <div className="tablewrap">
            <table className="tbl cmp">
              <thead>
                <tr>
                  <th scope="col">Measure</th>
                  <th scope="col" className="r">Run A (before)</th>
                  <th scope="col" className="r">Run B (after)</th>
                  <th scope="col" className="r">Delta (B - A)</th>
                  <th scope="col">Reading</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td className="r num">{num(row.a, row.digits)}</td>
                    <td className="r num">{num(row.b, row.digits)}</td>
                    <td className="r num">{row.a !== null && row.b !== null ? signed(row.b - row.a, row.digits) : '—'}</td>
                    <td className="small muted">{deltaWord(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.some((r) => r.group === 'test') && <p className="small muted">The test split is not drawn: at least one Run's protocol does not mark it as a visible diagnostic.</p>}
        </Section>
        <div className="vstack">
          <Section
            title={`Comparison mode: ${basis.mode.name}`}
            id="cmp-mode"
            caption={
              <>
                How the two Runs relate.{' '}
                <Info label="What this comparison mode means">
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
          <Section title="Basis fields" id="cmp-basis" caption="What each Run records for the dataset, horizon and window.">
            <div className="tablewrap">
              <table className="tbl cmp">
                <thead>
                  <tr>
                    <th scope="col">Field</th>
                    <th scope="col">Run A</th>
                    <th scope="col">Run B</th>
                    <th scope="col">State</th>
                  </tr>
                </thead>
                <tbody>
                  {basis.checks.map((c) => (
                    <tr key={c.key}>
                      <th scope="row">{c.label}</th>
                      <td className="mono small">{c.key === 'window' ? c.a ?? 'not in payload' : c.a ? (c.a.length > 40 ? short(c.a, 16) : c.a) : 'not in payload'}</td>
                      <td className="mono small">{c.key === 'window' ? c.b ?? 'not in payload' : c.b ? (c.b.length > 40 ? short(c.b, 16) : c.b) : 'not in payload'}</td>
                      <td>{c.state === 'same' ? 'Same' : c.state === 'different' ? 'Different' : 'Missing'}</td>
                    </tr>
                  ))}
                  <tr>
                    <th scope="row">Started (UTC)</th>
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
  const loadA = useRun(project.id, a)
  const loadB = useRun(project.id, b)
  const set = (next: { a?: string; b?: string }) => go(routeHref({ view: 'compare', id: project.id, a: next.a ?? a, b: next.b ?? b }))
  const error = loadA.state === 'error' ? loadA.message : loadB.state === 'error' ? loadB.message : null
  return (
    <div className="pg">
      <header className="pg-head">
        <h1>Compare two Runs</h1>
        <p className="muted small">Read-only. Both Runs come from the same Project and are verified by the server before they are shown.</p>
        <div className="cmp-pick">
          <RunSelect label="Run A (before)" runs={project.runs} value={a} onChange={(id) => set({ a: id })} />
          <RunSelect label="Run B (after)" runs={project.runs} value={b} onChange={(id) => set({ b: id })} />
        </div>
      </header>
      {!a || !b ? <p className="muted">Choose a Run A and a Run B to compare.</p> : null}
      {error && <Notice kind="error" label="Error" title="Could not load a Run." subtitle={error} />}
      {(loadA.state === 'loading' || loadB.state === 'loading') && <p className="muted">Loading Runs…</p>}
      {loadA.state === 'ready' && loadB.state === 'ready' && <Table a={loadA.payload.factorExplorer} b={loadB.payload.factorExplorer} project={project} />}
    </div>
  )
}
