import { translate, uiText, uiValue, useLanguage } from '../i18n'
import { useState } from 'react'
import { Glyph, Icon, Mark } from '../design/icons'
import type { ThemeName } from '../design/theme'
import { when } from '../format'
import { routeHref } from '../route'
import { REFRESH_MS, type ShellData } from '../useShellData'
import { Modal } from './Modal'
import { STATE_COPY } from '../components/stateCopy'
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
          {uiValue(o.text)}
        </button>
      ))}
    </div>
  )
}

/** When the data last loaded; a click refreshes now. A failed refresh says so and keeps the data. */
export function Updated({ data }: { data: ShellData }) {
  const language = useLanguage()
  const t = (en: string, zh: string) => translate(language, en, zh)
  if (data.updated === null) {
    return data.error === null ? (
      <span className="updated">{t('Loading…', '加载中…')}</span>
    ) : (
      <button type="button" className="updated is-stale" onClick={data.refresh}>
        <Glyph kind="error" signal />
          <span className="sig">{STATE_COPY.stale}</span>
          <span>{STATE_COPY.refresh}</span>
      </button>
    )
  }
  const time = when(data.updated.toISOString())
  const stale = data.error !== null
  const hint = stale
    ? (language === 'zh' ? `刷新失败；显示 ${time} UTC 的数据。点击重试。` : `Refresh failed; showing data from ${time} UTC. Click to retry.`)
    : data.live
      ? (language === 'zh' ? `页面可见时每 ${REFRESH_MS / 1000} 秒刷新。点击立即刷新。` : `Refreshes every ${REFRESH_MS / 1000} s while this tab is visible. Click to refresh now.`)
      : t('Automatic refresh is paused. Click to refresh now.', '自动刷新已暂停。点击立即刷新。')
  return (
    <button type="button" className={stale ? 'updated is-stale' : 'updated'} onClick={data.refresh} title={hint}>
      {stale && <Glyph kind="error" signal />}
      {stale && <span className="sig">{STATE_COPY.stale}</span>}
      {!data.live && (
        <span className="paused">
          <Icon name="pause" />
          {t('Paused', '已暂停')}
        </span>
      )}
      <span>{t('Updated', '更新于')}</span>
      <span className="mono">{time}{uiText(" UTC")}</span>
    </button>
  )
}

function LiveToggle({ data }: { data: ShellData }) {
  const language = useLanguage()
  const label = data.live ? translate(language, 'Pause automatic refresh', '暂停自动刷新') : translate(language, 'Resume automatic refresh', '恢复自动刷新')
  return (
    <button type="button" className="live-toggle" aria-label={label} title={label} aria-pressed={!data.live} onClick={() => data.setLive(!data.live)}>
      <Icon name={data.live ? 'pause' : 'play'} />
    </button>
  )
}

type Props = { crumbs: Crumb[]; data: ShellData; theme: ThemeName; onTheme: (theme: ThemeName) => void; onSearch: () => void }

export function TopBar({ crumbs, data, theme, onTheme, onSearch }: Props) {
  const language = useLanguage()
  const t = (en: string, zh: string) => translate(language, en, zh)
  const [settings, setSettings] = useState(false)
  const tools = (
    <>
      <span className="updated-group">
        <Updated data={data} />
        {data.updated !== null && <LiveToggle data={data} />}
      </span>
      <Choice label={t('Theme', '主题')} value={theme} options={[{ value: 'dark', text: t('Dark', '深色') }, { value: 'light', text: t('Light', '浅色') }]} onChange={onTheme} />
    </>
  )
  return (
    <header className="top">
      <a className="top-mark" href={routeHref({ view: 'projects' })} aria-label={uiText("AutoQuant Studio")}>
        <Mark />
      </a>
      <nav className="crumbs" aria-label={uiText("Breadcrumb")}>
        <ol>
          {crumbs.map((crumb, index) => (
            <li key={index}>
              {index === crumbs.length - 1 || crumb.href === undefined ? (
                <span className="is-here trunc" aria-current={index === crumbs.length - 1 ? 'page' : undefined} translate={crumb.data ? 'no' : undefined}>
                  {crumb.data ? crumb.label : uiValue(crumb.label)}
                </span>
              ) : (
                <a className="trunc" href={crumb.href} translate={crumb.data ? 'no' : undefined}>
                  {crumb.data ? crumb.label : uiValue(crumb.label)}
                </a>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <div className="tools">{tools}</div>
      <button type="button" className="top-button top-search" aria-label={uiText("Search")} aria-keyshortcuts="Control+K" onClick={onSearch}>
        <Icon name="search" />
      </button>
      <button type="button" className="top-button top-settings" aria-haspopup="dialog" onClick={() => setSettings(true)}>
        {t('Display', '显示')}
      </button>
      <Modal open={settings} onClose={() => setSettings(false)} label={t('Display', '显示')} className="sheet">
        <div className="sheet-body">
          <div className="sheet-head">
            <h2>{t('Display', '显示')}</h2>
            <button type="button" className="top-button" onClick={() => setSettings(false)}>
              {t('Close', '关闭')}
            </button>
          </div>
          <div className="sheet-tools">{tools}</div>
        </div>
      </Modal>
    </header>
  )
}
