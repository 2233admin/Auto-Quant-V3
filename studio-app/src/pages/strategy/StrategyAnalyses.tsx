import type { ProjectSnapshot } from '../../api'
import { uiText } from '../../i18n'
import { DataTable } from '../../library/DataTable'
import { runColumns } from '../../library/runColumns'
import { runKey, useHistory, type HistoryRun } from '../../library/runHistoryApi'
import { Empty } from '../../components/States'
import { routeHref } from '../../route'
import { CopyButton } from '../../actions/CopyButton'

const ANALYSIS_LANES = new Set(['Book Risk', 'Path Stress', 'Allocation', 'RL policy'])
const VIEWS = [
  ['bookRiskExplorer', 'bookrisk'], ['bookPathStressExplorer', 'bookstress'],
  ['allocationExplorer', 'allocation'], ['rlExplorer', 'rl'],
] as const
export const projectAnalysisRuns = (rows: HistoryRun[], projectId: string) => rows.filter(r => r.project.id === projectId && ANALYSIS_LANES.has(r.lane))

export function StrategyAnalyses({ project, go }: { project: ProjectSnapshot; go: (href: string) => void }) {
  const history = useHistory(project.library?.strategy?.updatedAt ?? '')
  const rows = projectAnalysisRuns(history.rows, project.id)
  const columns = runColumns([], () => {}).filter(c => c.id !== 'pick').map(c => c.id === 'run' ? { ...c, render: (r: HistoryRun) => <code>{r.id}</code> } : c)
  const evidence = (r: HistoryRun) => {
    const current = VIEWS.find(([key]) => (project[key] as { run?: { id?: string } } | null)?.run?.id === r.id)
    if (current) return <a href={routeHref({ view: current[1], id: project.id })}>{uiText('Open current analysis')}</a>
    const command = "aq run show '" + (project.rootDir ?? project.id).replaceAll("'", "''") + `' --run ${r.id} --json`
    return <details><summary>{uiText('Archived Run · CLI evidence')}</summary><pre className="cmd mono" translate="no">{command}</pre><CopyButton text={command} label={uiText('Copy command')} /></details>
  }
  return <div className="vstack">
    <h2 className="type-section">{uiText('Analyses')}</h2>
    <p className="small muted">{uiText('Only Book Risk, Path Stress, Allocation and governed RL Runs owned by this Project are linked here. Their assumptions and verdicts remain separate.')}</p>
    {history.loading && <p role="status">{uiText('Loading…')}</p>}
    {history.error && <p role="alert">{uiText('Could not load Run history.')} {history.error}</p>}
    {!history.loading && !history.error && !rows.length && <Empty title={uiText('No evidence in this Project')}><p>{uiText('This Project has no published Runs in these analysis lanes.')}</p></Empty>}
    {!!rows.length && <DataTable rows={rows} cols={[...columns, { id: 'evidence', label: uiText('Evidence'), render: evidence }]} rowKey={runKey} go={go} caption={uiText('Analyses owned by this Project')} initial={{ id: 'started', dir: -1 }} />}
  </div>
}
