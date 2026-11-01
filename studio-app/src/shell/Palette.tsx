import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import type { ProjectSummary } from '../api'
import { routeHref } from '../route'
import { Modal } from './Modal'

type Item = { group: string; label: string; detail: string; href: string }

type Props = { open: boolean; onClose: () => void; projects: ProjectSummary[]; go: (href: string) => void }

/** Ctrl K: jump to a page or a Project. */
export function Palette({ open, onClose, projects, go }: Props) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
    }
  }, [open])
  const items = useMemo<Item[]>(() => {
    const all: Item[] = [
      { group: 'Pages', label: 'Ideas', detail: 'Home', href: routeHref({ view: 'projects' }) },
      { group: 'Pages', label: 'Attention', detail: 'Needs a look', href: routeHref({ view: 'attention' }) },
      { group: 'Pages', label: 'Settings', detail: 'Actions and Workspace', href: routeHref({ view: 'settings' }) },
      { group: 'Pages', label: 'Factor library', detail: 'Factors', href: routeHref({ view: 'factors' }) },
      { group: 'Pages', label: 'Strategy library', detail: 'Portfolio, RL, Allocation', href: routeHref({ view: 'strategies' }) },
      { group: 'Pages', label: 'Run history', detail: 'Runs', href: routeHref({ view: 'runs' }) },
      { group: 'Pages', label: 'Tuning tasks', detail: 'Sessions and trials', href: routeHref({ view: 'tuning' }) },
      ...projects.map((p) => ({ group: 'Ideas', label: p.name, detail: p.id, href: routeHref({ view: 'project', id: p.id }) })),
    ]
    const needle = query.trim().toLowerCase()
    return needle ? all.filter((i) => `${i.label} ${i.detail}`.toLowerCase().includes(needle)) : all
  }, [projects, query])
  const choose = (item: Item | undefined) => {
    if (!item) return
    onClose()
    if (item.href.startsWith('/legacy')) window.location.assign(item.href)
    else go(item.href)
  }
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown') setActive((i) => Math.min(i + 1, items.length - 1))
    else if (event.key === 'ArrowUp') setActive((i) => Math.max(i - 1, 0))
    else if (event.key === 'Enter') choose(items[active])
    else return
    event.preventDefault()
  }
  let last = ''
  return (
    <Modal open={open} onClose={onClose} label="Search" className="palette">
      <div className="palette-body">
        <input
          className="palette-input"
          autoFocus
          placeholder="Search pages and Projects"
          aria-label="Search pages and Projects"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
          }}
          onKeyDown={onKey}
        />
        <div className="palette-list" role="listbox">
          {items.length === 0 && <p className="palette-empty">Nothing matches.</p>}
          {items.map((item, index) => {
            const head = item.group !== last
            last = item.group
            return (
              <div key={`${item.group}/${item.href}`}>
                {head && <div className="palette-group">{item.group}</div>}
                <div
                  role="option"
                  aria-selected={index === active}
                  className={index === active ? 'palette-item is-active' : 'palette-item'}
                  onMouseMove={() => setActive(index)}
                  onClick={() => choose(item)}
                >
                  <span translate="no">{item.label}</span>
                  <span className="palette-detail mono trunc" translate="no">{item.detail}</span>
                </div>
              </div>
            )
          })}
        </div>
        <p className="palette-keys">↑ ↓ to move · Enter to open · Esc to close</p>
      </div>
    </Modal>
  )
}
