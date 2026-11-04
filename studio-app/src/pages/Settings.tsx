import { translate, uiText, uiValue, useLanguage } from '../i18n'
import { useEffect, useState } from 'react'
import type { WorkspaceSummary } from '../api'
import { useActions } from '../actions/ActionsContext'
import { actionCall, errorCopy } from '../actions/client'
import { CopyButton } from '../actions/CopyButton'
import type { Catalog, CatalogAction } from '../actions/types'
import { Loading } from '../components/States'
import { Glyph } from '../design/icons'
import { PageHead } from '../library/parts'
import { Notice } from '../Notice'
import { SectionBar, SignConventionSetting } from '../components/workbench'
import { STATE_COPY } from '../components/stateCopy'
import './ideas.css'
const ENABLE_COMMAND = 'aq studio serve --allow-actions'
const AUDIT_FILE = ['.autoquant', 'studio-actions.jsonl']

/** Where the server appends its action audit log, spelled with the Workspace path's own separator. */
function auditPath(root: string): string {
  const sep = root.includes('\\') ? '\\' : '/'
  return [root.replace(/[\\/]+$/, ''), ...AUDIT_FILE].join(sep)
}

function KV({ rows }: { rows: [string, React.ReactNode, boolean?][] }) {
  return (
    <dl className="set-kv">
      {rows.map(([k, v, mono]) => (
        <div key={k} style={{ display: 'contents' }}>
          <dt>{uiText(k)}</dt>
          <dd className={mono ? 'mono' : undefined} translate={mono ? 'no' : undefined}>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** The action catalog, fetched without a Project filter. Never shows the token. */
function useActionCatalog(): { state: 'off' | 'loading' | 'ready' | 'error'; actions: CatalogAction[]; error?: string } {
  const { state, version } = useActions()
  const [load, setLoad] = useState<{ state: 'loading' | 'ready' | 'error'; actions: CatalogAction[]; error?: string }>({ state: 'loading', actions: [] })
  const bootstrap = state.mode === 'on' ? state.bootstrap : null
  useEffect(() => {
    if (!bootstrap) return
    const controller = new AbortController()
    actionCall<Catalog>(bootstrap, 'GET', bootstrap.catalog, undefined, controller.signal)
      .then((c) => setLoad({ state: 'ready', actions: c.actions }))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setLoad({ state: 'error', actions: [], error: errorCopy(reason, 'load the action catalog').detail })
      })
    return () => controller.abort()
  }, [bootstrap, version])
  return state.mode === 'on' ? load : { state: state.mode === 'off' ? 'off' : 'loading', actions: [] }
}

function ActionsSection({ workspace }: { workspace: WorkspaceSummary }) {
  const language = useLanguage()
  const t = (en: string, zh: string) => translate(language, en, zh)
  const catalog = useActionCatalog()
  const on = !!workspace.actions?.enabled
  const root = workspace.source.rootDir
  return (
    <section className="set-sec" aria-labelledby="set-actions">
      <SectionBar as="h2" id="set-actions" icon="lock" micro="ACTIONS">{t('Actions', '操作权限')}</SectionBar>
      <p>
        <Glyph kind={on ? 'supported' : 'empty'} /> {on ? t('On: Studio can start local jobs from the Project pages.', '已开启：Studio 可以从项目页面启动本地任务。') : STATE_COPY.readOnlyReason}
      </p>
      {!on && (
        <>
          <p className="small muted">{t('Start the server with the flag below to turn actions on. Studio never turns them on by itself.', '使用下方参数启动服务以开启操作权限。Studio 不会自行开启。')}</p>
          <div className="cmdrow">
            <pre className="cmd mono" translate="no">{ENABLE_COMMAND}</pre>
            <CopyButton text={ENABLE_COMMAND} label={t('Copy command', '复制命令')} />
          </div>
        </>
      )}
      <KV
        rows={[
          [t('Token', '令牌'), on ? t('Issued for this page, held in memory, never shown', '已向此页面发放，仅保存在内存中，不会显示') : t('None issued', '未发放')],
          [t('Audit log', '审计日志'), auditPath(root), true],
        ]}
      />
      {on && catalog.state === 'loading' && <Loading label={uiText("Loading…")} minHeight={60} />}
      {on && catalog.state === 'error' && <Notice kind="error" label={uiText("Error")} title={uiText("Could not load the action catalog.")} subtitle={catalog.error} />}
      {on && catalog.state === 'ready' && (
        <ul className="set-actions" aria-label={uiText("Available actions")}>
          {catalog.actions.map((a) => (
            <li key={a.id}>
              <span>{uiValue(a.label)}</span>
              <span className="faint small">
                <span className="mono" translate="no">{a.id}</span> · {a.classification}{uiText(" · writes ")}{a.writes}
                {a.requiresSecondConfirm ? uiText(" · needs a second confirmation") : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function WorkspaceSection({ workspace }: { workspace: WorkspaceSummary }) {
  const language = useLanguage()
  const t = (en: string, zh: string) => translate(language, en, zh)
  const h = workspace.harness
  const ws = workspace.source.workspace
  return (
    <section className="set-sec" aria-labelledby="set-workspace">
      <SectionBar as="h2" id="set-workspace" icon="folder" micro="WORKSPACE">{t('Workspace', '工作区')}</SectionBar>
      <KV
        rows={[
          [t('Path', '路径'), workspace.source.rootDir, true],
          ...(ws?.name ? ([[t('Name', '名称'), ws.name, true]] as [string, string, boolean][]) : []),
          ...(ws?.configurationPath ? ([[t('Configuration', '配置文件'), ws.configurationPath, true]] as [string, string, boolean][]) : []),
          ['Harness', h.id, true],
          [t('Version', '版本'), h.version, true],
          ['Commit', h.commit ?? 'unknown', true],
          [t('Uncommitted changes', '未提交的更改'), h.dirty ? t('Yes (dirty working tree)', '有') : t('No', '无')],
          [t('Source hash', '源代码哈希'), h.sourceHash ?? t('not reported', '未提供'), true],
        ]}
      />
    </section>
  )
}

const RULES = [
  'Trials are counted per research family and never removed.',
  'The holdout is sealed and can be opened once.',
  'Test split is hidden until the study is frozen.',
  'Verdicts come from the fixed Judge, not from Studio.',
]

/** Read-only: where this Studio runs and what it may do. Nothing here can be edited. */
export function SettingsPage({ workspace }: { workspace: WorkspaceSummary | null }) {
  const language = useLanguage()
  const t = (en: string, zh: string) => translate(language, en, zh)
  if (!workspace) {
    return (
      <div className="pg">
        <Loading label={uiText("Loading…")} minHeight={240} />
      </div>
    )
  }
  const h = workspace.harness
  const version = `AQ ${h.version}${h.commit ? `@${h.commit.slice(0, 7)}` : ''}${h.dirty ? '+dirty' : ''}`
  return (
    <div className="settings-page">
          <PageHead icon="settings" micro="SETTINGS" title={t('Settings', '设置')} lede={t('Where this Studio runs and what it may do.', '此 Studio 的运行位置与权限。')} />
          <SignConventionSetting readOnly={!workspace.actions?.enabled} />
          <ActionsSection workspace={workspace} />
          <WorkspaceSection workspace={workspace} />
          <section className="set-sec" aria-labelledby="set-rules">
            <SectionBar as="h2" id="set-rules" icon="check" micro="RULES">{t('Research rules', '研究规则')}</SectionBar>
            <p className="small muted">{t('Fixed by the Judge. Read-only.', '由判定器固定，仅供查看。')}</p>
            <ul>
              {RULES.map((r, i) => (
                <li key={r}>{language === 'zh' ? ['试验按研究族计数，记录不会删除。', '封存的留出集只能打开一次。', '审计完成前不显示测试数字。', '判决由固定判定器产生。'][i] : r}</li>
              ))}
            </ul>
          </section>
          <section className="set-sec" aria-labelledby="set-about">
            <SectionBar as="h2" id="set-about" icon="doc" micro="ABOUT">{t('About', '关于')}</SectionBar>
            <KV rows={[['Studio', version, true]]} />
            <p className="small">
              <a href="/legacy">{t('Open Legacy Studio', '打开旧版 Studio')}</a> <span className="muted">{t('for lanes that have no native page yet.', '查看尚无新版页面的研究方向。')}</span>
            </p>
          </section>
    </div>
  )
}
