import type { ProjectSnapshot } from '../../api'
import { uiText } from '../../i18n'
import { PaneCard, TabList, TitleCard, useHashTab, WorkbenchShell } from '../../components/workbench'
import { PortfolioPage } from '../portfolio/Portfolio'
import { RunHistory } from '../../library/RunHistory'
import { routeHref } from '../../route'
import { StrategyTuning } from './StrategyTuning'
import { StrategyAnalyses } from './StrategyAnalyses'
import { StrategyOrigin } from './StrategyOrigin'
import './strategy.css'

const TAB_IDS = ['backtest', 'versions', 'tuning', 'analyses'] as const
type Tab = typeof TAB_IDS[number]
const ALIASES: Record<string, Tab> = { 'pf-neighborhood': 'tuning', 'pf-book': 'backtest', 'pf-summary': 'backtest' }

export function StrategyPage({ project, go }: { project: ProjectSnapshot; go: (href: string) => void }) {
  const [tab, selectTab] = useHashTab<Tab>(TAB_IDS, 'backtest', ALIASES)
  const lifecycle = project.library?.strategy?.state ?? 'Not available'
  const tabs = TAB_IDS.map(id => ({ id, label: uiText(({ backtest: 'Backtest', versions: 'Versions', tuning: 'Tuning', analyses: 'Analyses' })[id]) }))
  return <div className="strategy-workbench">
    <TitleCard title={project.name} subtitle={project.description} backHref={routeHref({ view: 'strategies' })} backLabel={uiText('Back to Strategies')} type={uiText(lifecycle)} />
    <WorkbenchShell right={<PaneCard label={uiText('Strategy workbench')} tabs={<TabList label={uiText('Strategy sections')} tabs={tabs} active={tab} onSelect={selectTab} />} flush={tab === 'backtest'}>
      <div className="strategy-panel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'backtest' && <><StrategyOrigin project={project} /><PortfolioPage key={project.id} project={project} go={go} embedded /></>}
        {tab === 'versions' && <RunHistory workspace={null} go={go} projectId={project.id} lane="Portfolio" revision={project.library?.strategy?.updatedAt ?? ''} />}
        {tab === 'tuning' && <StrategyTuning project={project} />}
        {tab === 'analyses' && <StrategyAnalyses project={project} go={go} />}
      </div>
    </PaneCard>} />
  </div>
}
