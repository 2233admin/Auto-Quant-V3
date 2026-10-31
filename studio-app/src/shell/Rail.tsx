import { Glyph, Icon, Mark } from '../design/icons'
import { routeHref, type Route } from '../route'
import type { ShellData } from '../useShellData'

type RailProps = { route: Route; data: ShellData; narrow: boolean; onSearch: () => void }

/** Glyph and word for a Project's verification state. */
export function verification(valid: boolean) {
  return valid
    ? ({ glyph: 'supported', word: 'Verified', signal: false } as const)
    : ({ glyph: 'error', word: 'Needs attention', signal: true } as const)
}

export function Rail({ route, data, narrow, onSearch }: RailProps) {
  const projects = data.workspace?.projects ?? []
  const open = route.view === 'project' ? route.id : null
  const harness = data.workspace?.harness
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
          <span className="nav-label">Projects</span>
          <span className="nav-short">Projects</span>
          <span className="count mono">{data.workspace ? projects.length : '—'}</span>
        </a>
      </nav>
      {projects.length > 0 && (
        <section className="raildirs" aria-labelledby="rail-projects">
          <h2 className="railhead" id="rail-projects">Open a Project</h2>
          <ul>
            {projects.map((p) => {
              const look = verification(p.valid)
              return (
                <li key={p.id}>
                  <a
                    className={p.id === open ? 'railitem is-on' : 'railitem'}
                    href={routeHref({ view: 'project', id: p.id })}
                    aria-current={p.id === open ? 'page' : undefined}
                    title={p.name}
                  >
                    <Glyph kind={look.glyph} label={look.word} signal={look.signal} />
                    <span className="trunc" translate="no">{p.name}</span>
                  </a>
                </li>
              )
            })}
          </ul>
        </section>
      )}
      <div className="railfoot">
        <a className="railgit" href="/legacy">Legacy Studio →</a>
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

/** Phone navigation: the same section as a bottom tab bar. */
export function TabBar({ route, data }: { route: Route; data: ShellData }) {
  return (
    <nav className="tabbar" aria-label="Sections">
      <a className={route.view === 'projects' ? 'tab is-on' : 'tab'} href={routeHref({ view: 'projects' })}>
        <Icon name="directions" />
        <span className="nav-label">Projects</span>
        <span className="nav-short">Projects</span>
        <span className="count mono">{data.workspace ? data.workspace.projects.length : '—'}</span>
      </a>
    </nav>
  )
}
