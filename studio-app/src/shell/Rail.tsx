import { setLanguage, translate, uiTemplate, uiText, uiValue, useLanguage } from '../i18n'
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
  { view: 'assistant', get label() { return uiText("Assistant") }, icon: 'directions' },
  { view: 'factors', get label() { return uiText("Factors") }, icon: 'factors' },
  { view: 'strategies', get label() { return uiText("Strategies") }, icon: 'strategies' },
  { view: 'runs', get label() { return uiText("Runs") }, icon: 'runs' },
  { view: 'tuning', get label() { return uiText("Tuning") }, icon: 'tuning' },
] as const

function AssistantGlyph() {
  return <svg className="icon" width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 3.5h12v9H9l-5 4v-13Z" stroke="currentColor" strokeWidth="1.3" /><path d="M7 7h6M7 9.5h4" stroke="currentColor" strokeWidth="1.3" /></svg>
}

type RailProps = { route: Route; data: ShellData; narrow: boolean; onSearch: () => void }

/** Glyph and word for a Project's verification state. */
export function verification(valid: boolean) {
  return valid
    ? ({ glyph: 'supported', word: uiText("Verified"), signal: false } as const)
    : ({ glyph: 'error', word: uiText("Needs attention"), signal: true } as const)
}

export function Rail({ route, data, narrow: compact, onSearch }: RailProps) {
  const language = useLanguage()
  const t = (en: string, zh: string) => translate(language, en, zh)
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
      <a className="brand" href={routeHref({ view: 'projects' })} aria-label={narrow ? uiText("AutoQuant Studio") : undefined}>
        <Mark />
        <span>{uiText("AutoQuant Studio")}</span>
      </a>
      {data.workspace?.source.workspace && (
        <div className="ws">
          <span className="trunc mono" translate="no">{data.workspace.source.workspace.name}</span>
        </div>
      )}
      <nav aria-label={uiText("Sections")}>
        <a className={route.view === 'assistant' ? 'nav is-on' : 'nav'} href={routeHref({ view: 'assistant' })} aria-current={route.view === 'assistant' ? 'page' : undefined}>
          <AssistantGlyph />
          <span className="nav-label">{t('Assistant', '助手')}</span>
          <span className="nav-short">{t('Assistant', '助手')}</span>
        </a>
        <button type="button" className="rail-new" onClick={() => setNewIdea(true)} aria-label={t('New factor', '新建因子')}>+<span>{t('New factor', '新建因子')}</span></button>
        {(
          <ul className="raildirs" aria-label={uiText("Open recent")}>
            {recentProjects.map((p) => (
              <li key={p.id}>
                <a
                  className={p.id === open ? 'railitem is-on' : 'railitem'}
                  href={`${routeHref({ view: 'factor', id: p.id })}&idea=1`}
                  aria-current={p.id === open && route.view === 'project' ? 'page' : undefined}
                  title={uiTemplate("Open {0}", [p.name])}
                >
                  <span className="trunc" translate="no">{p.name}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
        {LIBRARY_NAV.filter((item) => item.view !== 'assistant').map((item) => (
          <a key={item.view} className={route.view === item.view ? 'nav is-on' : 'nav'} href={routeHref({ view: item.view })} aria-current={route.view === item.view ? 'page' : undefined}>
            <Icon name={item.icon} />
            <span className="nav-label">{t(item.label, ({ factors: '因子', strategies: '策略', runs: '运行记录', tuning: '调优' } as Record<string, string>)[item.view] ?? item.label)}</span>
            <span className="nav-short">{t(item.label, ({ factors: '因子', strategies: '策略', runs: '运行', tuning: '调优' } as Record<string, string>)[item.view] ?? item.label)}</span>
          </a>
        ))}
      </nav>
      <button type="button" className="rail-collapse" onClick={() => setCollapsed(v => !v)} aria-label={collapsed ? uiText("Expand sidebar") : uiText("Collapse sidebar")} aria-expanded={!narrow} disabled={compact} title={compact ? uiText("The sidebar is compact at this viewport width.") : undefined}>{narrow ? '»' : '«'}<span>{uiText("Collapse")}</span></button>
      <nav className="railbottom" aria-label={uiText("Workspace")}>
        <a className={route.view === 'attention' ? 'nav is-on' : 'nav'} href={routeHref({ view: 'attention' })} aria-current={route.view === 'attention' ? 'page' : undefined}>
          <Icon name="attention" />
          <span className="nav-label">{t('Attention', '待处理')}</span>
          <span className="nav-short">{t('Attention', '待处理')}</span>
          {data.workspace && <span className={attention > 0 ? 'count mono is-alert' : 'count mono'}>{attention}</span>}
        </a>
        <a className={route.view === 'settings' ? 'nav is-on' : 'nav'} href={routeHref({ view: 'settings' })} aria-current={route.view === 'settings' ? 'page' : undefined}>
          <Icon name="settings" />
          <span className="nav-label">{t('Settings', '设置')}</span>
          <span className="nav-short">{t('Settings', '设置')}</span>
        </a>
      </nav>
      <button type="button" className="search" onClick={onSearch} aria-keyshortcuts="Control+K" aria-label={uiText("Search")}>
        <Icon name="search" /><span>{t('Search', '搜索')}</span><kbd>{uiText("Ctrl K")}</kbd>
      </button>
      <button type="button" className="search" onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')} aria-label="Switch language / 切换语言">{language === 'en' ? '中文 / English' : '中文 / English'} <span>{language === 'en' ? uiText("EN") : '中'}</span></button>
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
  const language = useLanguage()
  const labels: Record<string, string> = { Assistant: '助手', Factors: '因子', Strategies: '策略', Runs: '运行', Tuning: '调优', Attention: '待处理', Settings: '设置' }
  const attention = attentionItems(data.workspace).length
  const tab = (view: 'projects' | 'attention' | 'settings' | (typeof LIBRARY_NAV)[number]['view'], label: string, icon: IconName, badge?: ReactNode) => (
    <a key={view} className={route.view === view ? 'tab is-on' : 'tab'} href={routeHref({ view })} aria-current={route.view === view ? 'page' : undefined}>
      {view === 'assistant' ? <AssistantGlyph /> : <Icon name={icon} />}
      <span className="nav-label">{language === 'zh' ? labels[label] ?? label : label}</span>
      <span className="nav-short">{language === 'zh' ? labels[label] ?? label : label}</span>
      {uiValue(badge)}
    </a>
  )
  return (
    <nav className="tabbar" aria-label={uiText("Sections")}>
      {LIBRARY_NAV.map((item) => tab(item.view, item.label, item.icon))}
      {tab('attention', 'Attention', 'attention', attention > 0 ? <span className="pending mono">{attention}</span> : null)}
      {tab('settings', 'Settings', 'settings')}
      <button type="button" className="tab" onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')} aria-label="Switch language / 切换语言">{language === 'en' ? '中文' : uiText("EN")}</button>
    </nav>
  )
}
