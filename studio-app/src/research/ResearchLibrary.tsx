import { uiTemplate, uiText } from '../i18n'
import type { ProjectSummary, WorkspaceSummary } from '../api'
import { Icon, PageMark } from '../design/marks'
import { DataTable, type Col } from '../library/DataTable'
import { routeHref } from '../route'
import { StateWord, Status } from './ResearchParts'
import { rowStateOf, statusOf } from './words'

const ORDER = ['proposed', 'selected', 'running', 'challenged', 'supported', 'rejected', 'inconclusive', 'confirmed', 'unconfirmed', 'dropped']

function counts(p: ProjectSummary) {
  const c = p.research?.statusCounts ?? {}
  return ORDER.filter((s) => c[s]).map((s) => `${c[s]} ${statusOf(s).word}`).join(' · ') || '—'
}

const COLS: Col<ProjectSummary>[] = [
  { id: 'name', label: 'Project', rowHeader: true, sort: (p) => p.name, render: (p) => <a href={routeHref({ view: 'research', id: p.id })} translate="no">{p.name}</a> },
  { id: 'direction', label: 'Direction', render: (p) => <span className="lib-hyp" translate="no">{p.research?.direction ?? '—'}</span> },
  { id: 'hyp', label: 'Hypotheses', align: 'r', sort: (p) => p.research?.hypotheses ?? null, render: (p) => p.research?.hypotheses ?? '—' },
  { id: 'states', label: 'States', render: (p) => <span className="small">{counts(p)}</span> },
  { id: 'verdict', label: 'Latest verdict', sort: (p) => p.research?.latestVerdict?.at ?? null, render: (p) => p.research?.latestVerdict ? <><Status status={p.research.latestVerdict.label} /> <span className="mono small" translate="no">{p.research.latestVerdict.hypothesis}</span></> : <span className="faint">{uiText("No verdict yet")}</span> },
  { id: 'lockbox', label: 'Lockbox', render: (p) => <StateWord {...rowStateOf(p.research?.lockbox ?? 'none')} /> },
  { id: 'demo', label: 'Data', render: (p) => (p.research?.demo ? <span className="sig small">{uiText("Synthetic demo")}</span> : <span className="small muted">{uiText("Research")}</span>) },
]

/** Projects that carry a Shinka research direction, with hypothesis count, states, latest verdict and lockbox. */
export function ResearchLibrary({ workspace, go }: { workspace: WorkspaceSummary; go: (href: string) => void }) {
  const rows = workspace.projects.filter((p) => p.research && p.research.state !== 'none')
  return (
    <div className="pg object-library rs-library">
      <header className="library-title sec-bar"><Icon name="doc" /><h1>{uiText("Research directions")}</h1><p>{uiText("Hypothesis-driven research: every Project here owns its hypotheses, trials, verdicts and lockbox.")}</p><PageMark kind="barcode" micro={`RESEARCH / ${String(rows.length).padStart(2, '0')}`} /></header>
      {rows.length === 0 ? (
        <p className="muted">{uiText("No Project has a research direction yet. Attach one with aq shinka init <workspace> --project ID --direction TEXT.")}</p>
      ) : (
        <DataTable rows={rows} cols={COLS.map((c) => ({ ...c, label: uiText(c.label) }))} rowKey={(p) => p.id} href={(p) => routeHref({ view: 'research', id: p.id })} go={go} caption={uiTemplate("{0} research directions", [rows.length])} />
      )}
      <p className="small"><a href={routeHref({ view: 'knowledge' })}>{uiText("Open the knowledge library")}</a></p>
    </div>
  )
}
