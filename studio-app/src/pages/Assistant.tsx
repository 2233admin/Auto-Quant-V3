import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { WorkspaceSummary } from '../api'
import { ACTIONS_OFF_COPY, useActions } from '../actions/ActionsContext'
import { actionCall, errorCopy } from '../actions/client'
import { routeHref } from '../route'
import './assistant.css'

type Provider = { id: string; label: string; available: boolean; reason?: string | null }
type SessionStatus = 'idle' | 'running' | 'awaiting-confirmation' | 'cancelled' | 'error'
type SessionSummary = {
  id: string; title: string; provider: string; project?: string | null; status: SessionStatus
  trialBudget?: number; usedTrials?: number; updatedAt?: string
}
type Message = { id: string; role: string; content: string; at: string }
type AssistantEvent = { id: string; type: string; at: string; data: Record<string, unknown> }
type ActionPreview = {
  display?: string; argv?: string[] | null; commandHash?: string | null; writes?: string
  requiresSecondConfirm?: boolean
  trial?: { n?: number; m?: number; notice?: string; adjustment?: { interpretation?: string; status?: string } | null } | null
}
type PendingAction = { id: string; preview: ActionPreview }
type AssistantSession = SessionSummary & {
  trialBudget: number; usedTrials: number; messages: Message[]; events: AssistantEvent[]
  pendingAction?: PendingAction | null; error?: string | { message?: string } | null
}
type AssistantIndex = { providers: Provider[]; sessions: SessionSummary[] }

/** Identifiers only. Project snapshots and hidden evidence never enter a chat from the browser. */
export type AssistantContext = { project: string; study?: string; run?: string; page?: string }
type SurfaceProps = {
  workspace: WorkspaceSummary | null
  context?: AssistantContext
  drawer?: boolean
}

const statusCopy: Record<SessionStatus, string> = {
  idle: 'Ready', running: 'Working', 'awaiting-confirmation': 'Needs your confirmation',
  cancelled: 'Stopped', error: 'Could not continue',
}
const isWorking = (session: AssistantSession | null) =>
  session?.status === 'running' || session?.status === 'awaiting-confirmation'

function remember(key: string, value?: string | null): string | null {
  try {
    if (value === undefined) return window.localStorage.getItem(key)
    if (value) window.localStorage.setItem(key, value)
    else window.localStorage.removeItem(key)
  } catch { /* Session history remains on the server when browser storage is unavailable. */ }
  return null
}

function duration(start: string | undefined, end: number): string {
  const first = start ? Date.parse(start) : NaN
  if (!Number.isFinite(first)) return '0s'
  const seconds = Math.max(0, Math.floor((end - first) / 1000))
  return seconds >= 60 ? Math.floor(seconds / 60) + 'm ' + seconds % 60 + 's' : seconds + 's'
}

function displayCommand(data: Record<string, unknown>): string | null {
  if (typeof data.display === 'string') return data.display
  if (typeof data.command === 'string') return data.command
  const argv = Array.isArray(data.argv) ? data.argv : Array.isArray(data.command) ? data.command : null
  return argv && argv.every((part) => typeof part === 'string') ? JSON.stringify(argv) : null
}

function EventTimeline({ events, running }: { events: AssistantEvent[]; running: boolean }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [running])
  const visible = events.filter((event) => !/^(text[._-]?delta|message[._-]?delta|assistant[._-]?delta|delta)$/.test(event.type))
  if (!visible.length) return null
  const commands = visible.filter((event) => displayCommand(event.data ?? {}) !== null)
  const last = visible[visible.length - 1]
  const end = running ? now : Date.parse(last.at)
  return (
    <details className="assistant-timeline">
      <summary>{visible.length} recorded events · {commands.length} commands · {duration(visible[0]?.at, end)}</summary>
      <ol>
        {visible.map((event) => {
          const data = event.data ?? {}
          const command = displayCommand(data)
          return (
            <li key={event.id}>
              <details>
                <summary><span>{event.type.replaceAll('_', ' ')}</span><time dateTime={event.at}>{new Date(event.at).toLocaleTimeString()}</time></summary>
                {command && <pre aria-label="Exact command">{command}</pre>}
                {typeof data.diff === 'string' && <pre aria-label="Proposed diff">{data.diff}</pre>}
                <pre aria-label="Recorded event data">{JSON.stringify(data, null, 2)}</pre>
              </details>
            </li>
          )
        })}
      </ol>
    </details>
  )
}

function Confirmation({ session, busy, onConfirm }: {
  session: AssistantSession
  busy: boolean
  onConfirm: (accepted: boolean, second: boolean) => void
}) {
  const [second, setSecond] = useState(false)
  const checkbox = useId()
  const action = session.pendingAction
  useEffect(() => setSecond(false), [action?.id, action?.preview.commandHash])
  if (!action) return null
  const preview = action.preview
  return (
    <section className="assistant-confirm" aria-label="Confirm proposed action">
      <h2>Review the next action</h2>
      <p>Trial {session.usedTrials + 1} of {session.trialBudget} in this chat.</p>
      {preview.trial?.m !== undefined && <p className="assistant-subtle">Research family count after this action: {preview.trial.m}. This is separate from the chat budget.</p>}
      <pre aria-label="Proposed command">{preview.display ?? JSON.stringify(preview.argv ?? [])}</pre>
      {preview.writes && <p>{preview.writes}</p>}
      {preview.trial?.notice && <p className="assistant-subtle">{preview.trial.notice}</p>}
      {preview.trial?.adjustment?.interpretation && <p className="assistant-subtle">{preview.trial.adjustment.interpretation}</p>}
      {preview.commandHash && <details><summary>Command identity</summary><code>{preview.commandHash}</code></details>}
      {preview.requiresSecondConfirm && (
        <label className="assistant-check" htmlFor={checkbox}>
          <input id={checkbox} type="checkbox" checked={second} onChange={(event) => setSecond(event.target.checked)} disabled={busy} />
          I understand that this action spends a counted trial and may expose audit evidence.
        </label>
      )}
      <div className="assistant-buttons">
        <button type="button" className="abtn" onClick={() => onConfirm(false, false)} disabled={busy}>Reject</button>
        <button type="button" className="abtn abtn--primary" onClick={() => onConfirm(true, second)} disabled={busy || (preview.requiresSecondConfirm === true && !second)}>Confirm and run</button>
      </div>
    </section>
  )
}

function ArtifactLinks({ session }: { session: AssistantSession | null }) {
  const refs: { key: string; project: string; run: string }[] = []
  for (const event of session?.events ?? []) {
    const data = event.data ?? {}
    const created = data.createdRefs && typeof data.createdRefs === 'object' ? data.createdRefs as Record<string, unknown> : data
    const project = typeof data.project === 'string' ? data.project : session?.project
    const run = created.runId
    if (project && typeof run === 'string' && !refs.some((ref) => ref.project === project && ref.run === run)) {
      refs.push({ key: project + ':' + run, project, run })
    }
  }
  return refs.length ? (
    <ul className="assistant-artifacts">
      {refs.map((ref) => <li key={ref.key}><a href={routeHref({ view: 'run', id: ref.project, run: ref.run })}>Inspect Run <span className="mono">{ref.run}</span></a></li>)}
    </ul>
  ) : <p className="assistant-subtle">Run links appear here when an action records its result.</p>
}

function AssistantSurface({ workspace, context, drawer = false }: SurfaceProps) {
  const actions = useActions()
  const bootstrap = actions.state.mode === 'on' ? actions.state.bootstrap : null
  const storageKey = 'aq-assistant:' + (workspace?.source.rootDir ?? '') + ':' + (context?.project ?? 'workspace')
  const [index, setIndex] = useState<AssistantIndex | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [session, setSession] = useState<AssistantSession | null>(null)
  const [provider, setProvider] = useState('claude')
  const [project, setProject] = useState(context?.project ?? '')
  const [budget, setBudget] = useState(10)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [reload, setReload] = useState(0)
  const thread = useRef<HTMLDivElement>(null)
  const follow = useRef(true)
  const sequence = useRef(0)
  const composer = useId()
  const providerField = useId()
  const projectField = useId()
  const budgetField = useId()

  useEffect(() => {
    setSelected(remember(storageKey))
    setSession(null)
    setProject(context?.project ?? '')
    setIndex(null)
  }, [storageKey, context?.project])

  useEffect(() => { remember(storageKey, selected) }, [storageKey, selected])

  useEffect(() => {
    if (!bootstrap) return
    let disposed = false
    let timer: number | undefined
    const controller = new AbortController()
    const poll = async () => {
      let working = false
      let failed = false
      try {
        const catalog = await actionCall<AssistantIndex>(bootstrap, 'GET', '/api/v1/assistant', undefined, controller.signal)
        if (disposed) return
        setIndex(catalog)
        if (selected) {
          setLoading(true)
          const current = await actionCall<AssistantSession>(bootstrap, 'GET', '/api/v1/assistant/session?' + new URLSearchParams({ id: selected }), undefined, controller.signal)
          if (disposed) return
          setSession(current)
          working = isWorking(current)
        }
        setConnectionError(null)
      } catch (reason) {
        if (disposed) return
        failed = true
        const copy = errorCopy(reason, 'refresh the conversation')
        setConnectionError(copy.title + ' ' + copy.detail)
      } finally {
        if (!disposed) {
          setLoading(false)
          timer = window.setTimeout(poll, failed ? 8000 : working ? 800 : 4000)
        }
      }
    }
    void poll()
    return () => { disposed = true; controller.abort(); window.clearTimeout(timer) }
  }, [bootstrap?.token, bootstrap?.tokenHeader, selected, reload])

  const lastMessage = session?.messages[session.messages.length - 1]
  useEffect(() => {
    if (follow.current && thread.current) thread.current.scrollTop = thread.current.scrollHeight
  }, [lastMessage?.id, lastMessage?.content, session?.status])

  const providers = index?.providers ?? []
  const selectedProvider = providers.find((item) => item.id === (session?.provider ?? provider))
  const projects = (workspace?.projects ?? []).filter((item) => item.valid && !item.externalHoldout.present)
  const boundProject = context?.project ?? session?.project ?? project
  const sealed = !!boundProject && workspace?.projects.find((item) => item.id === boundProject)?.externalHoldout.present
  const working = isWorking(session)
  const sessions = (index?.sessions ?? []).filter((item) => !context || item.project === context.project)

  function newChat(nextProvider = session?.provider ?? provider) {
    sequence.current += 1
    setSelected(null)
    setSession(null)
    setProvider(nextProvider)
    setDraft('')
    setError(null)
    follow.current = true
  }

  async function send(event: FormEvent) {
    event.preventDefault()
    if (!bootstrap || busy || working || !draft.trim() || sealed || selectedProvider?.available !== true) return
    const text = draft.trim()
    const turn = ++sequence.current
    setBusy(true)
    setError(null)
    try {
      let current = session
      if (!current) {
        const body = {
          provider, trialBudget: budget,
          ...(boundProject ? { project: boundProject } : {}),
          ...(context ? { context: { ...(context.study ? { study: context.study } : {}), ...(context.run ? { run: context.run } : {}), ...(context.page ? { page: context.page } : {}) } } : {}),
        }
        current = await actionCall<AssistantSession>(bootstrap, 'POST', '/api/v1/assistant/sessions', body)
        if (turn !== sequence.current) return
        setSelected(current.id)
        setSession(current)
      }
      const updated = await actionCall<AssistantSession>(bootstrap, 'POST', '/api/v1/assistant/message', { sessionId: current.id, content: text })
      if (turn !== sequence.current) return
      setSession(updated)
      setDraft('')
      follow.current = true
      setReload((value) => value + 1)
    } catch (reason) {
      const copy = errorCopy(reason, 'send the message')
      if (turn === sequence.current) setError(copy.title + ' ' + copy.detail)
    } finally {
      if (turn === sequence.current) setBusy(false)
    }
  }

  async function changeSession(action: 'cancel' | 'confirm', accepted = false, second = false) {
    if (!bootstrap || !session || busy) return
    setBusy(true)
    setError(null)
    try {
      const pending = session.pendingAction
      const body = action === 'cancel' ? { sessionId: session.id } : {
        sessionId: session.id, actionId: pending?.id, accepted,
        ...(pending?.preview.commandHash ? { commandHash: pending.preview.commandHash } : {}),
        secondConfirm: second,
      }
      const current = await actionCall<AssistantSession>(bootstrap, 'POST', '/api/v1/assistant/' + action, body)
      setSession(current)
      actions.jobFinished()
      setReload((value) => value + 1)
    } catch (reason) {
      const copy = errorCopy(reason, action === 'cancel' ? 'stop this turn' : 'confirm this action')
      setError(copy.title + ' ' + copy.detail)
      setReload((value) => value + 1)
    } finally { setBusy(false) }
  }

  const sessionError = typeof session?.error === 'string' ? session.error : session?.error?.message
  const canSend = !!bootstrap && !!index && !loading && !busy && !working && !sealed && selectedProvider?.available === true && !!draft.trim()
  return (
    <div className={'assistant' + (drawer ? ' assistant--drawer' : '')}>
      <header className="assistant-head">
        <div><h1>Assistant</h1><p>Research with your local agent.</p></div>
        <label htmlFor={providerField}>Local agent
          <select id={providerField} value={session?.provider ?? provider} disabled={busy || !index} onChange={(event) => newChat(event.target.value)}>
            {!providers.some((item) => item.id === (session?.provider ?? provider)) && <option value={session?.provider ?? provider}>Choose an agent</option>}
            {providers.map((item) => <option key={item.id} value={item.id}>{item.label}{item.available ? '' : ' · unavailable'}</option>)}
          </select>
        </label>
      </header>
      {!bootstrap && <div className="assistant-banner" role="status">{actions.state.mode === 'loading' ? 'Loading Studio…' : ACTIONS_OFF_COPY}</div>}
      {selectedProvider?.reason && <div className="assistant-banner" role="status">{selectedProvider.reason}</div>}
      {sealed && <div className="assistant-banner assistant-banner--error" role="alert">This Project is a sealed holdout. It cannot be attached to Assistant.</div>}
      {connectionError && <div className="assistant-banner assistant-banner--error" role="alert"><span>{connectionError}</span><button className="abtn" type="button" onClick={() => { setConnectionError(null); setReload((value) => value + 1) }}>Retry connection</button></div>}
      {error && <div className="assistant-banner assistant-banner--error" role="alert"><span>{error}</span><button className="abtn" type="button" onClick={() => setError(null)}>Dismiss</button></div>}
      <div className="assistant-layout">
        <aside className="assistant-sessions" aria-label="Conversations">
          <button className="abtn" type="button" onClick={() => newChat()} disabled={busy}>+ New chat</button>
          {bootstrap && !index && <p className="assistant-subtle">Loading conversations…</p>}
          {index && sessions.length === 0 && <p className="assistant-subtle">Your conversations will stay here.</p>}
          <ul>
            {sessions.map((item) => (
              <li key={item.id}><button type="button" aria-current={selected === item.id ? 'true' : undefined} disabled={busy} onClick={() => {
                sequence.current += 1
                setSelected(item.id)
                setSession(null)
                setLoading(true)
                setDraft('')
                setError(null)
                follow.current = true
              }}><span>{item.title || 'New chat'}</span><small>{providers.find((p) => p.id === item.provider)?.label ?? item.provider} · {statusCopy[item.status] ?? item.status}</small></button></li>
            ))}
          </ul>
        </aside>
        <section className="assistant-conversation" aria-label="Conversation">
          <div className="assistant-conversation-head">
            <h2>{session?.title || 'New chat'}</h2>
            <span role="status">{loading && !session ? 'Loading…' : session ? statusCopy[session.status] : 'Ready when you are'}</span>
            {working && <button type="button" className="abtn" disabled={busy} onClick={() => void changeSession('cancel')}>Stop</button>}
          </div>
          <div className="assistant-thread" ref={thread} onScroll={() => { const box = thread.current; if (box) follow.current = box.scrollHeight - box.scrollTop - box.clientHeight < 100 }}>
            {!session && !loading && <div className="assistant-empty"><h2>What would you like to investigate?</h2><p>Ask about your factors, explain a verdict, or describe a candidate change.</p><div className="assistant-prompts">{['List my factors and compare their validation evidence.', 'Explain why this factor did not pass.', 'Propose a change and show me the diff.'].map((prompt) => <button type="button" key={prompt} onClick={() => setDraft(prompt)} disabled={!bootstrap || busy}>{prompt}</button>)}</div></div>}
            <div role="log" aria-label="Messages" aria-live="polite" aria-relevant="additions text">
              {(session?.messages ?? []).map((message) => <article className={'assistant-message assistant-message--' + (message.role === 'user' ? 'user' : 'agent')} key={message.id}><header><strong>{message.role === 'user' ? 'You' : message.role === 'assistant' ? selectedProvider?.label ?? 'Assistant' : message.role}</strong><time dateTime={message.at}>{new Date(message.at).toLocaleTimeString()}</time></header><div>{message.content}</div></article>)}
            </div>
            {session && <EventTimeline events={session.events} running={session.status === 'running'} />}
            {session?.pendingAction && <Confirmation session={session} busy={busy} onConfirm={(accepted, second) => void changeSession('confirm', accepted, second)} />}
            {sessionError && <p className="assistant-session-error" role="alert">{sessionError}</p>}
            {session?.status === 'cancelled' && <p className="assistant-subtle" role="status">Turn stopped. Retained research evidence remains in the Project.</p>}
            {session?.status === 'running' && <p className="assistant-subtle" role="status">The local agent is working. Recorded activity appears above.</p>}
          </div>
          <form className="assistant-compose" onSubmit={(event) => void send(event)}>
            <label htmlFor={composer}>Message</label>
            <textarea id={composer} rows={3} maxLength={16000} value={draft} disabled={busy || working || !bootstrap || sealed} placeholder="Ask about your research…" onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); event.currentTarget.form?.requestSubmit() }
            }} />
            <div><span>Ctrl / ⌘ + Enter to send</span><button className="abtn abtn--primary" type="submit" disabled={!canSend}>{busy ? 'Sending…' : 'Send'}</button></div>
          </form>
        </section>
        <aside className="assistant-inspector" aria-label="Research context">
          <h2>Research context</h2>
          <label htmlFor={projectField}>Project
            <select id={projectField} value={boundProject ?? ''} disabled={!!context || !!session || busy} onChange={(event) => setProject(event.target.value)}>
              <option value="">Workspace</option>
              {projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              {sealed && boundProject && <option value={boundProject}>Sealed holdout · unavailable</option>}
            </select>
          </label>
          {context?.study && <p>Study <span className="mono">{context.study}</span></p>}
          {context?.run && <p>Run <span className="mono">{context.run}</span></p>}
          <p className="assistant-subtle">Only these object identifiers are attached. Evidence is queried through the governed aq tools.</p>
          <label htmlFor={budgetField}>Trial budget
            <input id={budgetField} type="number" min={0} max={100} step={1} value={session?.trialBudget ?? budget} disabled={!!session || busy} onChange={(event) => setBudget(Math.max(0, Math.min(100, Math.floor(Number(event.target.value) || 0))))} />
          </label>
          <p className="assistant-subtle">{session ? session.usedTrials + ' of ' + session.trialBudget + ' trials spent or reserved.' : 'Fixed when the chat starts. Each proposed trial still requires your confirmation.'}</p>
          <h2>Artifacts</h2>
          <ArtifactLinks session={session} />
          <p className="assistant-subtle">Unsupported execution is blocked by the server. Provider and isolation errors appear in the conversation.</p>
        </aside>
      </div>
    </div>
  )
}

export function AssistantPage({ workspace }: { workspace: WorkspaceSummary | null; go?: (href: string) => void }) {
  return <AssistantSurface workspace={workspace} />
}

export function AssistantDrawer({ workspace, context, onClose }: {
  workspace: WorkspaceSummary | null
  context: AssistantContext
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useId()
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => { if (element?.open) element.close() }
  }, [])
  return (
    <dialog ref={dialog} className="assistant-drawer" aria-labelledby={title} onCancel={(event) => { event.preventDefault(); onClose() }}>
      <div className="assistant-drawer-head"><h2 id={title}>Ask Assistant about this {context.page === 'portfolio' ? 'strategy' : 'factor'}</h2><button type="button" className="abtn" onClick={onClose}>Close</button></div>
      <AssistantSurface workspace={workspace} context={context} drawer />
    </dialog>
  )
}
