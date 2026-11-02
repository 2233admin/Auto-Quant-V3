import { translate, uiTemplate, uiText, uiValue, useLanguage } from '../i18n'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { WorkspaceSummary } from '../api'
import { ACTIONS_OFF_COPY, useActions } from '../actions/ActionsContext'
import { actionCall, errorCopy } from '../actions/client'
import { routeHref } from '../route'
import './assistant.css'
import { DiagnosticText } from '../components/DiagnosticText'

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
const statusZh: Record<SessionStatus, string> = { idle: '就绪', running: '研究中', 'awaiting-confirmation': '等待确认', cancelled: '已停止', error: '无法继续' }
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
  const language = useLanguage()
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
      <summary>{language === 'zh' ? `${visible.length} 条记录 · ${commands.length} 条命令 · ${duration(visible[0]?.at, end)}` : uiTemplate("{0} recorded events · {1} commands · {2}", [visible.length, commands.length, duration(visible[0]?.at, end)])}</summary>
      <ol>
        {visible.map((event) => {
          const data = event.data ?? {}
          const command = displayCommand(data)
          return (
            <li key={event.id}>
              <details>
                <summary><span>{event.type.replaceAll('_', ' ')}</span><time dateTime={event.at}>{new Date(event.at).toLocaleTimeString()}</time></summary>
                {command && <pre aria-label={uiText("Exact command")}>{command}</pre>}
                {typeof data.diff === 'string' && <pre aria-label={uiText("Proposed diff")}>{data.diff}</pre>}
                <pre aria-label={uiText("Recorded event data")}>{JSON.stringify(data, null, 2)}</pre>
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
  const language = useLanguage()
  const t = (en: string, zh: string) => translate(language, en, zh)
  const [second, setSecond] = useState(false)
  const checkbox = useId()
  const action = session.pendingAction
  useEffect(() => setSecond(false), [action?.id, action?.preview.commandHash])
  if (!action) return null
  const preview = action.preview
  return (
    <section className="assistant-confirm" aria-label={uiText("Confirm proposed action")}>
      <h2>{t('Review the next action', '审阅下一步操作')}</h2>
      <p>{language === 'zh' ? `本对话第 ${session.usedTrials + 1} 次试验，共 ${session.trialBudget} 次。` : uiTemplate("Trial {0} of {1} in this chat.", [session.usedTrials + 1, session.trialBudget])}</p>
      {preview.trial?.m !== undefined && <p className="assistant-subtle">{language === 'zh' ? `执行后的研究族试验总数：${preview.trial.m}。这与对话预算分别计算。` : uiTemplate("Research family count after this action: {0}. This is separate from the chat budget.", [preview.trial.m])}</p>}
      <pre aria-label={uiText("Proposed command")}>{preview.display ?? JSON.stringify(preview.argv ?? [])}</pre>
      {preview.writes && <p>{preview.writes}</p>}
      {preview.trial?.notice && <p className="assistant-subtle">{preview.trial.notice}</p>}
      {preview.trial?.adjustment?.interpretation && <p className="assistant-subtle">{preview.trial.adjustment.interpretation}</p>}
      {preview.commandHash && <details><summary>{t('Command identity', '命令标识')}</summary><code>{preview.commandHash}</code></details>}
      {preview.requiresSecondConfirm && (
        <label className="assistant-check" htmlFor={checkbox}>
          <input id={checkbox} type="checkbox" checked={second} onChange={(event) => setSecond(event.target.checked)} disabled={busy} />
          {t('I understand that this action spends a counted trial and may expose audit evidence.', '我了解此操作会计入一次试验，并可能展示审计证据。')}
        </label>
      )}
      <div className="assistant-buttons">
        <button type="button" className="abtn" onClick={() => onConfirm(false, false)} disabled={busy}>{t('Reject', '拒绝')}</button>
        <button type="button" className="abtn abtn--primary" onClick={() => onConfirm(true, second)} disabled={busy || (preview.requiresSecondConfirm === true && !second)}>{t('Confirm and run', '确认并运行')}</button>
      </div>
    </section>
  )
}

function ArtifactLinks({ session }: { session: AssistantSession | null }) {
  const language = useLanguage()
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
      {refs.map((ref) => <li key={ref.key}><a href={routeHref({ view: 'run', id: ref.project, run: ref.run })}>{translate(language, 'Inspect Run', '查看运行记录')} <span className="mono">{ref.run}</span></a></li>)}
    </ul>
  ) : <p className="assistant-subtle">{translate(language, 'Run links appear here when an action records its result.', '操作产生运行结果后，链接会显示在这里。')}</p>
}

function AssistantSurface({ workspace, context, drawer = false }: SurfaceProps) {
  const language = useLanguage()
  const t = (en: string, zh: string) => translate(language, en, zh)
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
  const stage = session?.pendingAction ? t('Review action', '审阅操作') : session?.status === 'running' ? t('Researching', '研究中') : session?.status === 'error' ? t('Needs attention', '需要处理') : session?.messages.length ? t('Review response', '查看回复') : t('Describe your research', '描述研究需求')

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
    if (!bootstrap || busy || working || (selected !== null && !session) || !draft.trim() || sealed || selectedProvider?.available !== true) return
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
  const canSend = !!bootstrap && !!index && !loading && (selected === null || !!session) && !busy && !working && !sealed && selectedProvider?.available === true && !!draft.trim()
  return (
    <div className={'assistant' + (drawer ? ' assistant--drawer' : '')}>
      <header className="assistant-head">
        <div><h1>{t('Assistant', '研究助手')}</h1><p>{t('Research with your local agent.', '与本地智能体一起开展研究。')}</p></div>
        <label htmlFor={providerField}>{t('Local agent', '本地智能体')}
          <select id={providerField} value={session?.provider ?? provider} disabled={busy || !index} onChange={(event) => newChat(event.target.value)}>
            {!providers.some((item) => item.id === (session?.provider ?? provider)) && <option value={session?.provider ?? provider}>{t('Choose an agent', '选择智能体')}</option>}
            {providers.map((item) => <option key={item.id} value={item.id}>{uiValue(item.label)}{item.available ? '' : t(' · unavailable', ' · 不可用')}</option>)}
          </select>
        </label>
      </header>
      {!bootstrap && <div className="assistant-banner" role="status">{actions.state.mode === 'loading' ? t('Loading Studio…', '正在加载 Studio…') : language === 'zh' ? '当前为只读模式。请使用 --allow-actions 启动 Studio 以启用操作。' : ACTIONS_OFF_COPY}</div>}
      {selectedProvider?.reason && <div className="assistant-banner" role="status"><DiagnosticText value={selectedProvider.reason} /></div>}
      {sealed && <div className="assistant-banner assistant-banner--error" role="alert">{t('This Project is a sealed holdout. It cannot be attached to Assistant.', '此项目是封存留出集，无法附加到助手。')}</div>}
      {connectionError && <div className="assistant-banner assistant-banner--error" role="alert"><span>{connectionError}</span><button className="abtn" type="button" onClick={() => { setConnectionError(null); setReload((value) => value + 1) }}>{t('Retry connection', '重试连接')}</button></div>}
      {error && <div className="assistant-banner assistant-banner--error" role="alert"><span>{error}</span><button className="abtn" type="button" onClick={() => setError(null)}>{t('Dismiss', '关闭')}</button></div>}
      <div className="assistant-layout">
        <aside className="assistant-sessions" aria-label={uiText("Conversations")}>
          <button className="abtn" type="button" onClick={() => newChat()} disabled={busy}>{t('+ New chat', '+ 新建对话')}</button>
          {bootstrap && !index && <p className="assistant-subtle">{t('Loading conversations…', '正在加载对话…')}</p>}
          {index && sessions.length === 0 && <p className="assistant-subtle">{t('Your conversations will stay here.', '你的对话会保存在这里。')}</p>}
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
              }}><span>{item.title || t('New chat', '新建对话')}</span><small>{providers.find((p) => p.id === item.provider)?.label ?? item.provider} · {language === 'zh' ? statusZh[item.status] ?? item.status : statusCopy[item.status] ?? item.status}</small></button></li>
            ))}
          </ul>
        </aside>
        <section className="assistant-conversation" aria-label={uiText("Conversation")}>
          <div className="assistant-conversation-head">
            <h2>{session?.title || t('New chat', '新建对话')}</h2>
            <span role="status">{loading && !session ? t('Loading…', '加载中…') : session ? (language === 'zh' ? statusZh[session.status] : statusCopy[session.status]) : t('Ready when you are', '准备就绪')}</span>
            {working && <button type="button" className="abtn" disabled={busy} onClick={() => void changeSession('cancel')}>{t('Stop', '停止')}</button>}
          </div>
          <div className="assistant-thread" ref={thread} onScroll={() => { const box = thread.current; if (box) follow.current = box.scrollHeight - box.scrollTop - box.clientHeight < 100 }}>
            {!session && !loading && <div className="assistant-empty"><h2>{t('What would you like to investigate?', '你想研究什么？')}</h2><p>{t('Ask about your factors, explain a verdict, or describe a candidate change.', '查询因子、解释判决，或描述你想尝试的改动。')}</p><div className="assistant-prompts">{(language === 'zh' ? ['列出我的因子并比较验证证据。', '解释这个因子为什么没有通过。', '提出一项改动并展示差异。'] : ['List my factors and compare their validation evidence.', 'Explain why this factor did not pass.', 'Propose a change and show me the diff.']).map((prompt) => <button type="button" key={prompt} onClick={() => setDraft(prompt)} disabled={!bootstrap || busy}>{prompt}</button>)}</div></div>}
            <div role="log" aria-label={uiText("Messages")} aria-live="polite" aria-relevant="additions text">
              {(session?.messages ?? []).map((message) => <article className={'assistant-message assistant-message--' + (message.role === 'user' ? 'user' : 'agent')} key={message.id}><header><strong>{message.role === 'user' ? t('You', '你') : message.role === 'assistant' ? selectedProvider?.label ?? t('Assistant', '助手') : message.role}</strong><time dateTime={message.at}>{new Date(message.at).toLocaleTimeString()}</time></header><div>{message.content}</div></article>)}
            </div>
            {session && <EventTimeline events={session.events} running={session.status === 'running'} />}
            {session?.pendingAction && <Confirmation session={session} busy={busy} onConfirm={(accepted, second) => void changeSession('confirm', accepted, second)} />}
            {sessionError && <p className="assistant-session-error" role="alert"><DiagnosticText value={sessionError} error /></p>}
            {session?.status === 'cancelled' && <p className="assistant-subtle" role="status">{t('Turn stopped. Retained research evidence remains in the Project.', '本轮已停止，已保留的研究证据仍在项目中。')}</p>}
            {session?.status === 'running' && <p className="assistant-subtle" role="status">{t('The local agent is working. Recorded activity appears above.', '本地智能体正在工作，操作记录显示在上方。')}</p>}
          </div>
          <form className="assistant-compose" onSubmit={(event) => void send(event)}>
            <label htmlFor={composer}>{t('Message', '消息')}</label>
            <textarea id={composer} rows={3} maxLength={16000} value={draft} disabled={busy || working || !bootstrap || sealed} placeholder={t('Ask about your research…', '输入你的研究问题…')} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); event.currentTarget.form?.requestSubmit() }
            }} />
            <div><span>{t('Ctrl / ⌘ + Enter to send', 'Ctrl / ⌘ + Enter 发送')}</span><button className="abtn abtn--primary" type="submit" disabled={!canSend}>{busy ? t('Sending…', '发送中…') : t('Send', '发送')}</button></div>
          </form>
        </section>
        <aside className="assistant-inspector" aria-label={uiText("Research context")}>
          <h2>{t('Research overview', '研究概览')}</h2>
          <div className="assistant-stage" role="status"><span>{t('Current step', '当前步骤')}</span><strong>{uiValue(stage)}</strong><p>{session?.pendingAction ? t('Review the proposed action in the conversation before it runs.', '运行前请在对话中审阅提议的操作。') : session?.status === 'running' ? t('Follow the recorded activity in the conversation.', '在对话中查看操作过程。') : session?.status === 'error' ? t('See the conversation for the error and next action.', '在对话中查看错误和下一步。') : session?.messages.length ? t('Review the response and any recorded results below.', '查看回复和下方记录的结果。') : t('Choose a project and tell the assistant what you want to investigate.', '选择项目，告诉助手你想研究什么。')}</p></div>
          <h2>{t('Research context', '研究上下文')}</h2>
          <label htmlFor={projectField}>{t('Project', '项目')}
            <select id={projectField} value={boundProject ?? ''} disabled={!!context || !!session || busy} onChange={(event) => setProject(event.target.value)}>
              <option value="">{t('Workspace', '工作区')}</option>
              {projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              {sealed && boundProject && <option value={boundProject}>{t('Sealed holdout · unavailable', '封存留出集 · 不可用')}</option>}
            </select>
          </label>
          {context?.study && <p>{t('Study', '研究')} <span className="mono">{context.study}</span></p>}
          {context?.run && <p>{t('Run', '运行')} <span className="mono">{context.run}</span></p>}
          <p className="assistant-subtle">{t('Only these object identifiers are attached. Evidence is queried through the governed aq tools.', '这里只附带对象标识；研究证据通过受约束的 aq 工具查询。')}</p>
          <label htmlFor={budgetField}>{t('Trial budget', '试验预算')}
            <input id={budgetField} type="number" min={0} max={100} step={1} value={session?.trialBudget ?? budget} disabled={!!session || busy} onChange={(event) => setBudget(Math.max(0, Math.min(100, Math.floor(Number(event.target.value) || 0))))} />
          </label>
          <p className="assistant-subtle">{session ? (language === 'zh' ? `已使用或预留 ${session.usedTrials} / ${session.trialBudget} 次试验。` : session.usedTrials + ' of ' + session.trialBudget + ' trials spent or reserved.') : t('Fixed when the chat starts. Each proposed trial still requires your confirmation.', '对话开始时固定预算；每次试验仍需你确认。')}</p>
          <h2>{t('Artifacts', '研究成果')}</h2>
          <ArtifactLinks session={session} />
          <p className="assistant-subtle">{t('Unsupported execution is blocked by the server. Provider and isolation errors appear in the conversation.', '不受支持的执行会被服务端阻止；智能体和隔离错误会显示在对话中。')}</p>
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
  const language = useLanguage()
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useId()
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => { if (element?.open) element.close() }
  }, [])
  return (
    <dialog ref={dialog} className="assistant-drawer" aria-labelledby={title} onCancel={(event) => { event.preventDefault(); onClose() }}>
      <div className="assistant-drawer-head"><h2 id={title}>{language === 'zh' ? `向助手询问这个${context.page === 'portfolio' ? '策略' : '因子'}` : uiTemplate("Ask Assistant about this {0}", [context.page === 'portfolio' ? 'strategy' : 'factor'])}</h2><button type="button" className="abtn" onClick={onClose}>{translate(language, 'Close', '关闭')}</button></div>
      <AssistantSurface workspace={workspace} context={context} drawer />
    </dialog>
  )
}
