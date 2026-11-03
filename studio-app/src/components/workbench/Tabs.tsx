import { uiValue } from '../../i18n'
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { hashWithJob, sectionOfHash } from '../../actions/jobHash'
import { Icon, type IconName } from '../../design/icons'
import { useSlidingHighlight } from '../motion/useSlidingHighlight'
import '../motion/motion.css'
import './workbench.css'

export type TabDef<T extends string> = { id: T; label: string; badge?: string; icon?: IconName }

/** Hash-selected tab (`#tab-<id>`, job id kept). `aliases` maps an old section anchor to the tab that now holds it. Same contract as pages/FactorWorkbench. */
export function useHashTab<T extends string>(ids: readonly T[], fallback: T, aliases: Record<string, T> = {}): [T, (id: T) => void, string | null] {
  const read = useCallback((): { tab: T; anchor: string | null } => {
    let hash = ''
    try {
      hash = decodeURIComponent(sectionOfHash())
    } catch {
      hash = sectionOfHash()
    }
    if (hash.startsWith('tab-')) {
      const id = hash.slice(4) as T
      if (ids.includes(id)) return { tab: id, anchor: null }
    }
    const alias = aliases[hash]
    return alias ? { tab: alias, anchor: hash } : { tab: fallback, anchor: null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join('|'), fallback])
  const [state, setState] = useState(read)
  useEffect(() => {
    const on = () => setState(read())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [read])
  const select = useCallback((id: T) => {
    setState({ tab: id, anchor: null })
    window.history.replaceState(null, '', window.location.pathname + window.location.search + hashWithJob(`tab-${id}`))
  }, [])
  return [state.tab, select, state.anchor]
}

/** The tablist alone (arrows, Home, End; roving tabindex), for the `tabs` slot of a PaneCard header. */
export function TabList<T extends string>({
  label,
  tabs,
  active,
  onSelect,
}: {
  label: string
  tabs: TabDef<T>[]
  active: T
  onSelect: (id: T) => void
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const list = useRef<HTMLDivElement>(null)
  useSlidingHighlight(list, { items: '.wb-tab', active: '.wb-tab[aria-selected="true"]' })
  const move = (event: KeyboardEvent, index: number) => {
    const last = tabs.length - 1
    const next = event.key === 'ArrowRight' ? (index === last ? 0 : index + 1) : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1) : event.key === 'Home' ? 0 : event.key === 'End' ? last : -1
    if (next < 0) return
    event.preventDefault()
    onSelect(tabs[next].id)
    refs.current[tabs[next].id]?.focus()
  }
  return (
    <div ref={list} className="wb-tablist mo-hl mo-hl--tabs" role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => {
            refs.current[t.id] = el
          }}
          type="button"
          role="tab"
          id={`tab-${t.id}`}
          aria-selected={t.id === active}
          aria-controls={`panel-${t.id}`}
          tabIndex={t.id === active ? 0 : -1}
          className="wb-tab"
          onClick={() => onSelect(t.id)}
          onKeyDown={(e) => move(e, i)}
        >
          {t.icon && <Icon name={t.icon} />}
          {uiValue(t.label)}
          {t.badge && <span className="wb-tab-badge">{uiValue(t.badge)}</span>}
        </button>
      ))}
    </div>
  )
}

/** Tablist plus the active panel; API-compatible with `Tabs` in pages/FactorWorkbench so a page can swap the import path. */
export function Tabs<T extends string>({
  label,
  tabs,
  active,
  onSelect,
  panels,
}: {
  label: string
  tabs: TabDef<T>[]
  active: T
  onSelect: (id: T) => void
  panels: Record<T, ReactNode>
}) {
  return (
    <div className="wb-tabs">
      <TabList label={label} tabs={tabs} active={active} onSelect={onSelect} />
      <div className="wb-tabpanel" role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`} tabIndex={0}>
        {panels[active]}
      </div>
    </div>
  )
}
