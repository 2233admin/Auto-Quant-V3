import { useRef, useState, type ReactNode } from 'react'
import { NewIdeaDialog } from '../pages/NewIdeaDialog'
import { useSlidingHighlight } from '../components/motion/useSlidingHighlight'
import '../components/motion/motion.css'
import { Icon, Mark, type IconName } from '../design/icons'
import { attentionItems, useRecentProjects } from '../ideas'
import { routeHref, routeProjectId, type Route } from '../route'
import type { ShellData } from '../useShellData'

/** Task-named libraries, below Ideas (home). */
const LIBRARY_NAV = [
  { view: 'factors', label: 'Factors', icon: 'factors' },
  { view: 'strategies', label: 'Strategies', icon: 'strategies' },
  { view: 'runs', label: 'Runs', icon: 'runs' },
  { view: 'tuning', label: 'Tuning', icon: 'tuning' },
] as const

type RailProps = { route: Route; data: ShellData; narrow: boolean; onSearch: () => void }

/** Glyph and word for a Project's verification state. */
export function verification(valid: boolean) {
  return valid
    ? ({ glyph: 'supported', word: 'Verified', signal: false } as const)
    : ({ glyph: 'error', word: 'Needs attention', signal: true } as const)
}

export function Rail({ route, data, narrow: compact, onSearch }: RailProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [newIdea, setNewIdea] = useState(false)
  const narrow = compact || collapsed
  const projects = data.workspace?.projects ?? []
  const open = routeProjectId(route)
  const rail = useRef<HTMLElement>(null)
  useSlidingHighlight(rail, { items: 'a.nav, a.railitem' })
  const harness = data.workspace?.harness
  const recent = useRecentProjects(open)
  const factors = projects.filter(p => p.library?.factor)
  const recentProjects = [...recent.map(id => factors.find(p => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p), ...[...factors].sort((a,b) => (b.latestRunAt ?? '').localeCompare(a.latestRunAt ?? ''))].filter((p,i,a) => a.findIndex(q => q.id === p.id) === i).slice(0,3)
  const attention = attentionItems(data.workspace).length
  return (
    <aside ref={rail} data-measure="sidebar" className={narrow ? 'rail is-narrow mo-hl' : 'rail mo-hl'}>
      <a className="brand" href={routeHref({ view: 'projects' })} aria-label={narrow ? 'AutoQuant Studio' : undefined}>
        <Mark />
        <span>AutoQuant Studio</span>
      </a>
      {data.workspace?.source.workspace && (
        <div className="ws">
          <span className="trunc mono" translate="no">{data.workspace.source.workspace.name}</span>
        </div>
      )}
      <nav aria-label="Sections">
        <button type="button" className="rail-new" onClick={() => setNewIdea(true)} aria-label="New factor">+<span>New factor</span></button>
        {(
          <ul className="raildirs" aria-label="Open recent">
            {recentProjects.map((p) => (
              <li key={p.id}>
                <a
                  className={p.id === open ? 'railitem is-on' : 'railitem'}
                  href={`${routeHref({ view: 'factor', id: p.id })}&idea=1`}
                  aria-current={p.id === open && route.view === 'project' ? 'page' : undefined}
                  title={`Open ${p.name}`}
                >
                  <span className="trunc" translate="no">{p.name}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
        {LIBRARY_NAV.map((item) => (
          <a key={item.view} className={route.view === item.view ? 'nav is-on' : 'nav'} href={routeHref({ view: item.view })} aria-current={route.view === item.view ? 'page' : undefined}>
            <Icon name={item.icon} />
            <span className="nav-label">{item.label}</span>
            <span className="nav-short">{item.label}</span>
          </a>
        ))}
      </nav>
      <button type="button" className="rail-collapse" onClick={() => setCollapsed(v => !v)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!narrow} disabled={compact} title={compact ? 'The sidebar is compact at this viewport width.' : undefined}>{narrow ? '»' : '«'}<span>Collapse</span></button>
      <nav className="railbottom" aria-label="Workspace">
        <a className={route.view === 'attention' ? 'nav is-on' : 'nav'} href={routeHref({ view: 'attention' })} aria-current={route.view === 'attention' ? 'page' : undefined}>
          <Icon name="attention" />
          <span className="nav-label">Attention</span>
          <span className="nav-short">Attention</span>
          {data.workspace && <span className={attention > 0 ? 'count mono is-alert' : 'count mono'}>{attention}</span>}
        </a>
        <a className={route.view === 'settings' ? 'nav is-on' : 'nav'} href={routeHref({ view: 'settings' })} aria-current={route.view === 'settings' ? 'page' : undefined}>
          <Icon name="settings" />
          <span className="nav-label">Settings</span>
          <span className="nav-short">Settings</span>
        </a>
      </nav>
      <button type="button" className="search" onClick={onSearch} aria-keyshortcuts="Control+K" aria-label="Search">
        <Icon name="search" /><span>Search</span><kbd>Ctrl K</kbd>
      </button>
      <div className="railfoot">
        {harness && (
          <span className="mono" translate="no">
            AQ {harness.version}
            {harness.commit ? `@${harness.commit.slice(0, 7)}` : ''}
            {harness.dirty ? '+dirty' : ''}
          </span>
        )}
      </div>
      <NewIdeaDialog open={newIdea} onClose={() => setNewIdea(false)} />
    </aside>
  )
}

/** Phone navigation: the same sections as a bottom tab bar. */
export function TabBar({ route, data }: { route: Route; data: ShellData }) {
  const attention = attentionItems(data.workspace).length
  const tab = (view: 'projects' | 'attention' | 'settings' | (typeof LIBRARY_NAV)[number]['view'], label: string, icon: IconName, badge?: ReactNode) => (
    <a key={view} className={route.view === view ? 'tab is-on' : 'tab'} href={routeHref({ view })} aria-current={route.view === view ? 'page' : undefined}>
      <Icon name={icon} />
      <span className="nav-label">{label}</span>
      <span className="nav-short">{label}</span>
      {badge}
    </a>
  )
  return (
    <nav className="tabbar" aria-label="Sections">
      {LIBRARY_NAV.map((item) => tab(item.view, item.label, item.icon))}
      {tab('attention', 'Attention', 'attention', attention > 0 ? <span className="pending mono">{attention}</span> : null)}
      {tab('settings', 'Settings', 'settings')}
    </nav>
  )
}
