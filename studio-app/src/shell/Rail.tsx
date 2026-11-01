import type { ReactNode } from 'react'
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

export function Rail({ route, data, narrow, onSearch }: RailProps) {
  const projects = data.workspace?.projects ?? []
  const open = routeProjectId(route)
  const harness = data.workspace?.harness
  const recent = useRecentProjects(open)
  const recentProjects = recent.map((id) => projects.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p)
  const attention = attentionItems(data.workspace).length
  return (
    <aside className={narrow ? 'rail is-narrow' : 'rail'}>
      <a className="brand" href={routeHref({ view: 'projects' })} aria-label={narrow ? 'AutoQuant Studio' : undefined}>
        <Mark />
        <span>AutoQuant Studio</span>
      </a>
      {data.workspace?.source.workspace && (
        <div className="ws">
          <span className="trunc mono" translate="no">{data.workspace.source.workspace.name}</span>
        </div>
      )}
      <button type="button" className="search" onClick={onSearch} aria-keyshortcuts="Control+K" aria-label={narrow ? 'Search' : undefined}>
        <Icon name="search" />
        <span>Search</span>
        <kbd>Ctrl K</kbd>
      </button>
      <nav aria-label="Sections">
        <a className={route.view === 'projects' ? 'nav is-on' : 'nav'} href={routeHref({ view: 'projects' })} aria-current={route.view === 'projects' ? 'page' : undefined}>
          <Icon name="directions" />
          <span className="nav-label">Ideas</span>
          <span className="nav-short">Ideas</span>
          <span className="count mono">{data.workspace ? projects.length : '—'}</span>
        </a>
        {recentProjects.length > 0 && (
          <ul className="raildirs" aria-label="Open recent">
            {recentProjects.map((p) => (
              <li key={p.id}>
                <a
                  className={p.id === open ? 'railitem is-on' : 'railitem'}
                  href={routeHref({ view: 'project', id: p.id })}
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
      <div className="railfoot">
        {harness && (
          <span className="mono" translate="no">
            AQ {harness.version}
            {harness.commit ? `@${harness.commit.slice(0, 7)}` : ''}
            {harness.dirty ? '+dirty' : ''}
          </span>
        )}
      </div>
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
      {tab('projects', 'Ideas', 'directions')}
      {LIBRARY_NAV.map((item) => tab(item.view, item.label, item.icon))}
      {tab('attention', 'Attention', 'attention', attention > 0 ? <span className="pending mono">{attention}</span> : null)}
      {tab('settings', 'Settings', 'settings')}
    </nav>
  )
}
