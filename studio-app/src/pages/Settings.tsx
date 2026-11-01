import { useEffect, useState } from 'react'
import type { WorkspaceSummary } from '../api'
import { useActions } from '../actions/ActionsContext'
import { actionCall, errorCopy } from '../actions/client'
import { CopyButton } from '../actions/CopyButton'
import type { Catalog, CatalogAction } from '../actions/types'
import { Loading } from '../components/States'
import { Glyph } from '../design/icons'
import { Notice } from '../Notice'
import { PaneCard, WorkbenchShell } from '../components/workbench'
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
          <dt>{k}</dt>
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
  const catalog = useActionCatalog()
  const on = !!workspace.actions?.enabled
  const root = workspace.source.rootDir
  return (
    <section className="set-sec" aria-labelledby="set-actions">
      <h2 id="set-actions">Actions</h2>
      <p>
        <Glyph kind={on ? 'supported' : 'empty'} /> {on ? 'On: Studio can start local jobs from the Project pages.' : 'Off: Studio is read-only.'}
      </p>
      {!on && (
        <>
          <p className="small muted">Start the server with the flag below to turn actions on. Studio never turns them on by itself.</p>
          <div className="cmdrow">
            <pre className="cmd mono" translate="no">{ENABLE_COMMAND}</pre>
            <CopyButton text={ENABLE_COMMAND} label="Copy command" />
          </div>
        </>
      )}
      <KV
        rows={[
          ['Token', on ? 'Issued for this page, held in memory, never shown' : 'None issued'],
          ['Audit log', auditPath(root), true],
        ]}
      />
      {on && catalog.state === 'loading' && <Loading label="Loading actions…" minHeight={60} />}
      {on && catalog.state === 'error' && <Notice kind="error" label="Error" title="Could not load the action catalog." subtitle={catalog.error} />}
      {on && catalog.state === 'ready' && (
        <ul className="set-actions" aria-label="Available actions">
          {catalog.actions.map((a) => (
            <li key={a.id}>
              <span>{a.label}</span>
              <span className="faint small">
                <span className="mono" translate="no">{a.id}</span> · {a.classification} · writes {a.writes}
                {a.requiresSecondConfirm ? ' · needs a second confirmation' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function WorkspaceSection({ workspace }: { workspace: WorkspaceSummary }) {
  const h = workspace.harness
  const ws = workspace.source.workspace
  return (
    <section className="set-sec" aria-labelledby="set-workspace">
      <h2 id="set-workspace">Workspace</h2>
      <KV
        rows={[
          ['Path', workspace.source.rootDir, true],
          ...(ws?.name ? ([['Name', ws.name, true]] as [string, string, boolean][]) : []),
          ...(ws?.configurationPath ? ([['Configuration', ws.configurationPath, true]] as [string, string, boolean][]) : []),
          ['Harness', h.id, true],
          ['Version', h.version, true],
          ['Commit', h.commit ?? 'unknown', true],
          ['Uncommitted changes', h.dirty ? 'Yes (dirty working tree)' : 'No'],
          ['Source hash', h.sourceHash ?? 'not reported', true],
        ]}
      />
    </section>
  )
}

const RULES = [
  'Trials are counted per research family and never removed.',
  'The holdout is sealed and can be opened once.',
  'Test numbers stay hidden until their audit exists.',
  'Verdicts come from the fixed Judge, not from Studio.',
]

/** Read-only: where this Studio runs and what it may do. Nothing here can be edited. */
export function SettingsPage({ workspace }: { workspace: WorkspaceSummary | null }) {
  if (!workspace) {
    return (
      <div className="pg">
        <Loading label="Loading Workspace…" minHeight={240} />
      </div>
    )
  }
  const h = workspace.harness
  const version = `AQ ${h.version}${h.commit ? `@${h.commit.slice(0, 7)}` : ''}${h.dirty ? '+dirty' : ''}`
  return (
    <WorkbenchShell
      ratio={50}
      left={
        <PaneCard label="Actions and Workspace" tabs={<h1 className="set-title">Settings</h1>}>
          <ActionsSection workspace={workspace} />
          <WorkspaceSection workspace={workspace} />
        </PaneCard>
      }
      right={
        <PaneCard label="Research rules and About" tabs={<h2 className="set-title">Rules and About</h2>}>
          <section className="set-sec" aria-labelledby="set-rules">
            <h2 id="set-rules">Research rules</h2>
            <p className="small muted">Fixed by the Judge. Read-only.</p>
            <ul>
              {RULES.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </section>
          <section className="set-sec" aria-labelledby="set-about">
            <h2 id="set-about">About</h2>
            <KV rows={[['Studio', version, true]]} />
            <p className="small">
              <a href="/legacy">Open Legacy Studio</a> <span className="muted">for lanes that have no native page yet.</span>
            </p>
          </section>
        </PaneCard>
      }
    />
  )
}
