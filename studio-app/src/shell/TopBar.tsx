import { useState } from 'react'
import { Glyph, Icon, Mark } from '../design/icons'
import type { ThemeName } from '../design/theme'
import { when } from '../format'
import { routeHref } from '../route'
import { REFRESH_MS, type ShellData } from '../useShellData'
import { Modal } from './Modal'

export type Crumb = { label: string; href?: string; data?: boolean }

type ChoiceProps<T extends string> = {
  label: string
  value: T
  options: { value: T; text: string }[]
  onChange: (value: T) => void
}

function Choice<T extends string>({ label, value, options, onChange }: ChoiceProps<T>) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.text}
        </button>
      ))}
    </div>
  )
}

/** When the data last loaded; a click refreshes now. A failed refresh says so and keeps the data. */
export function Updated({ data }: { data: ShellData }) {
  if (data.updated === null) {
    return data.error === null ? (
      <span className="updated">Loading…</span>
    ) : (
      <button type="button" className="updated is-stale" onClick={data.refresh}>
        <Glyph kind="error" signal />
        <span className="sig">Stale</span>
        <span>Refresh</span>
      </button>
    )
  }
  const time = when(data.updated.toISOString())
  const stale = data.error !== null
  const hint = stale
    ? `Refresh failed; showing data from ${time} UTC. Click to retry.`
    : data.live
      ? `Refreshes every ${REFRESH_MS / 1000} s while this tab is visible. Click to refresh now.`
      : 'Automatic refresh is paused. Click to refresh now.'
  return (
    <button type="button" className={stale ? 'updated is-stale' : 'updated'} onClick={data.refresh} title={hint}>
      {stale && <Glyph kind="error" signal />}
      {stale && <span className="sig">Stale</span>}
      {!data.live && (
        <span className="paused">
          <Icon name="pause" />
          Paused
        </span>
      )}
      <span>Updated</span>
      <span className="mono">{time} UTC</span>
    </button>
  )
}

function LiveToggle({ data }: { data: ShellData }) {
  const label = data.live ? 'Pause automatic refresh' : 'Resume automatic refresh'
  return (
    <button type="button" className="live-toggle" aria-label={label} title={label} aria-pressed={!data.live} onClick={() => data.setLive(!data.live)}>
      <Icon name={data.live ? 'pause' : 'play'} />
    </button>
  )
}

type Props = { crumbs: Crumb[]; data: ShellData; theme: ThemeName; onTheme: (theme: ThemeName) => void; onSearch: () => void }

export function TopBar({ crumbs, data, theme, onTheme, onSearch }: Props) {
  const [settings, setSettings] = useState(false)
  const tools = (
    <>
      <span className="updated-group">
        <Updated data={data} />
        {data.updated !== null && <LiveToggle data={data} />}
      </span>
      <Choice label="Theme" value={theme} options={[{ value: 'dark', text: 'Dark' }, { value: 'light', text: 'Light' }]} onChange={onTheme} />
    </>
  )
  return (
    <header className="top">
      <a className="top-mark" href={routeHref({ view: 'projects' })} aria-label="AutoQuant Studio">
        <Mark />
      </a>
      <nav className="crumbs" aria-label="Breadcrumb">
        <ol>
          {crumbs.map((crumb, index) => (
            <li key={index}>
              {index === crumbs.length - 1 || crumb.href === undefined ? (
                <span className="is-here trunc" aria-current={index === crumbs.length - 1 ? 'page' : undefined} translate={crumb.data ? 'no' : undefined}>
                  {crumb.label}
                </span>
              ) : (
                <a className="trunc" href={crumb.href} translate={crumb.data ? 'no' : undefined}>
                  {crumb.label}
                </a>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <div className="tools">{tools}</div>
      <button type="button" className="top-button top-search" aria-label="Search" aria-keyshortcuts="Control+K" onClick={onSearch}>
        <Icon name="search" />
      </button>
      <button type="button" className="top-button top-settings" aria-haspopup="dialog" onClick={() => setSettings(true)}>
        Display
      </button>
      <Modal open={settings} onClose={() => setSettings(false)} label="Display" className="sheet">
        <div className="sheet-body">
          <div className="sheet-head">
            <h2>Display</h2>
            <button type="button" className="top-button" onClick={() => setSettings(false)}>
              Close
            </button>
          </div>
          <div className="sheet-tools">{tools}</div>
        </div>
      </Modal>
    </header>
  )
}
