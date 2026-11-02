import type { ProjectSnapshot } from '../../api'
import { uiText } from '../../i18n'
import { routeHref } from '../../route'
import { RunSelect } from '../run/RunSelect'
import { useRead, type Comparison } from '../../library/runHistoryApi'
import { compareReason } from './comparisonCopy'
import { ComparisonResults, ProtocolFacts } from './ComparisonResults'
import '../run/run.css'
import './compare.css'

export function ComparePage({ project, a, b, projectB, go }: { project: ProjectSnapshot; a?: string; b?: string; projectB?: string; go: (href: string) => void }) {
  const url = a && b ? `/api/v1/run-compare?${new URLSearchParams({ project: project.id, a, b, projectB: projectB ?? project.id })}` : undefined
  const read = useRead<Comparison>(url)
  const set = (next: { a?: string; b?: string }) => go(routeHref({ view: 'compare', id: project.id, a, b, projectB, ...next }))
  return <div className="pg">
    <header className="pg-head cmp-head"><h1>{uiText('Compare two Runs')}</h1>
      <p className="small muted">{uiText('Read-only development evidence. A difference is not independent confirmation or promotion authority.')}</p>
      <div className="cmp-pick">
        <RunSelect bar label={uiText('Baseline (A)')} runs={project.runs} value={a} onChange={id => set({ a: id })} />
        {projectB && projectB !== project.id ? <p className="mono small">{projectB} / {b}</p> : <RunSelect bar label={uiText('Subject (B)')} runs={project.runs} value={b} onChange={id => set({ b: id })} />}
      </div>
    </header>
    <p className="basis small" role={read?.error ? 'alert' : 'status'}>{compareReason(a && b ? 2 : 0, read?.data, read?.error)}</p>
    {read?.data && <>
      <div className="cmp-identities">{[read.data.a, read.data.b].map((r, i) => <div key={i}><strong>{uiText(i === 0 ? 'Baseline (A)' : 'Subject (B)')}</strong><p translate="no">{r.project.name} · {r.studyId}</p><p className="mono small">{r.id}</p></div>)}</div>
      {read.data.status === 'comparable' && <ComparisonResults comparison={read.data} />}
      <ProtocolFacts comparison={read.data} />
    </>}
  </div>
}
