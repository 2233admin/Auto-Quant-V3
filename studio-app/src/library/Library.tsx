import { uiText } from '../i18n'
import type { WorkspaceSummary } from '../api'
import type { Route } from '../route'
import { FactorLibrary } from './FactorLibrary'
import { RunHistory } from './RunHistory'
import { StrategyLibrary } from './StrategyLibrary'
import { TuningPage } from './Tuning'
import { Loading } from '../components/States'

export type LibraryRoute = Extract<Route, { view: 'factors' | 'runs' | 'strategies' | 'tuning' }>

export const isLibraryRoute = (route: Route): route is LibraryRoute =>
  route.view === 'factors' || route.view === 'runs' || route.view === 'strategies' || route.view === 'tuning'

export const LIBRARY_TITLE: Record<LibraryRoute['view'], string> = { factors: 'Factor library', runs: 'Run history', strategies: 'Strategy library', tuning: 'Tuning tasks' }

/** The four read-only cross-Project pages: one list, filters on top, click a row to open detail. */
export function LibraryPage({ route, workspace, go }: { route: LibraryRoute; workspace: WorkspaceSummary | null; go: (href: string) => void }) {
  if (!workspace) return <div className="pg"><Loading label={uiText("Loading Workspace…")} minHeight={240} /></div>
  if (route.view === 'factors') return <FactorLibrary workspace={workspace} go={go} />
  if (route.view === 'runs') return <RunHistory workspace={workspace} go={go} />
  if (route.view === 'strategies') return <StrategyLibrary workspace={workspace} go={go} />
  return <TuningPage workspace={workspace} id={route.id} go={go} />
}
