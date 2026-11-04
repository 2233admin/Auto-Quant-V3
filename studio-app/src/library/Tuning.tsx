import { coreWord, translate, uiTemplate, uiText, uiValue, useLanguage } from '../i18n'
import { useMemo, useState } from 'react'
import type { ProjectSnapshot, ProjectSummary, SessionSnapshot, TrialRow, WorkspaceSummary } from '../api'
import { Info } from '../components/Info'
import { MetricTile } from '../components/MetricTile'
import { Section } from '../design/layout'
import { Glyph, type GlyphKind } from '../design/icons'
import { num, plural, pct, ret, when } from '../format'
import { Notice } from '../Notice'
import type { NeighborConfig } from '../pages/portfolio/portfolioTypes'
import { routeHref } from '../route'
import { sessionOf, useAllProjects, type Loaded } from './data'
import { DataTable, type Col } from './DataTable'
import { Empty, LoadNote, PageHead } from './parts'
import { Loading } from '../components/States'
/** Trial as the Session decision matrix publishes it; `metrics` is only read for display. */
type Trial = TrialRow & { metrics?: Record<string, number | null> }
type Matrix = {
  objective?: { direction?: string; metric?: string; minimumImprovement?: number }
  scope?: { trialLimit: number; totalCandidateTrials: number; displayedCandidateTrials: number; omittedCandidateTrials: number }
  trials?: Trial[]
}

type Phase = 'queued' | 'running' | 'done' | 'failed'
const PHASE: Record<Phase, { word: string; glyph: GlyphKind; signal: boolean }> = {
  queued: { get word() { return uiText("Queued") }, glyph: 'proposed', signal: false },
  running: { get word() { return uiText("Running") }, glyph: 'running', signal: false },
  done: { get word() { return uiText("Done") }, glyph: 'supported', signal: false },
  failed: { get word() { return uiText("Failed") }, glyph: 'error', signal: true },
}

/** Maps the server's trial status string to a counter. Unknown words count as failed so nothing is silently dropped. */
export function phaseOf(t: Pick<TrialRow, 'status' | 'verdict'>): Phase {
  const s = t.status.toLowerCase()
  if (s === 'succeeded' && t.verdict !== 'CRASH') return 'done'
  if (s === 'queued' || s === 'pending' || s === 'proposed') return 'queued'
  if (s === 'running' || s === 'started' || s === 'in-progress') return 'running'
  return 'failed'
}

const matrixOf = (s: SessionSnapshot): Matrix | null => (s.decisionMatrix as Matrix | null | undefined) ?? null
const trialsOf = (s: SessionSnapshot): Trial[] => matrixOf(s)?.trials ?? []

// ----------------------------------------------------------------------------------------------- index

type Task = { key: string; project: ProjectSummary; session: SessionSnapshot; id: string; status: string; studyId: string; metric: string | null; trials: Trial[]; updated: string | null }

function tasksOf(all: Loaded[]): Task[] {
  return all.flatMap((l) =>
    (l.project?.sessions ?? []).map((session) => {
      const s = sessionOf(session)
      return {
        key: `${l.summary.id}/${s.id}`,
        project: l.summary,
        session,
        id: s.id,
        status: s.status,
        studyId: s.studyId,
        metric: matrixOf(session)?.objective?.metric ?? null,
        trials: trialsOf(session),
        updated: session.session?.updatedAt ?? null,
      }
    }),
  )
}

function Index({ workspace, go }: { workspace: WorkspaceSummary | null; go: (href: string) => void }) {
  const language = useLanguage()
  const t = (en: string, zh: string) => translate(language, en, zh)
  const all = useAllProjects(workspace)
  const rows = useMemo(() => tasksOf(all), [all])
  const href = (t: Task) => routeHref({ view: 'tuning', id: t.project.id })
  const count = (t: Task, p: Phase) => t.trials.filter((x) => phaseOf(x) === p).length
  const cols: Col<Task>[] = [
    {
      id: 'session',
      label: t('Tuning task (Session)', '调优任务（会话）'),
      rowHeader: true,
      sort: (t) => t.id,
      render: (t) => (
        <>
          <a href={href(t)} className="mono" translate="no">{t.id.replace(/^session-/, '')}</a>
          <span className="faint small" translate="no">{t.project.name}</span>
        </>
      ),
    },
    { id: 'study', label: t('Study', '研究'), sort: (t) => t.studyId, render: (t) => <span className="mono small" translate="no">{t.studyId}</span> },
    { id: 'status', label: t('Status', '状态'), sort: (t) => t.status, render: (t) => t.status ? uiText(t.status) : '—' },
    { id: 'objective', label: t('Objective', '目标'), sort: (t) => t.metric, render: (row) => (row.metric ? <span className="mono small" translate="no">{row.metric}</span> : <span className="faint small">{t('not published', '未发布')}</span>) },
    { id: 'trials', label: t('Trials', '试验'), align: 'r', sort: (t) => t.trials.length, render: (t) => t.trials.length },
    { id: 'done', label: t('Done', '已完成'), align: 'r', sort: (t) => count(t, 'done'), render: (t) => count(t, 'done') },
    { id: 'failed', label: t('Failed', '失败'), align: 'r', sort: (t) => count(t, 'failed'), render: (t) => count(t, 'failed') },
    { id: 'updated', label: t('Updated (UTC)', '更新时间 (UTC)'), sort: (t) => t.updated, render: (t) => <span className="mono">{when(t.updated)}</span> },
  ]
  return (
    <div className="pg">
      <PageHead
        icon="tuning" micro="TUNING"
        title={t('Tuning tasks', '调优任务')}
        lede={language === 'zh' ? `共 ${rows.length} 个会话，来自 ${new Set(rows.map((r) => r.project.id)).size} 个项目。点击行以查看详情。` : uiTemplate("{0} across {1}. Click a row to open it.", [plural(rows.length, 'Session'), plural(new Set(rows.map((r) => r.project.id)).size, 'Project')])}
        info={<p>{t('A Session is the closest thing here to a tuning task: a baseline and its recorded candidate trials.', '会话包含一个基线及其记录的候选试验。')}</p>}
      />
      <LoadNote all={all} />
      {rows.length === 0 ? (
        <Empty>{t('No Session was found in this Workspace, so there are no trials to list.', '此工作区没有会话，因此没有可列出的试验。')}</Empty>
      ) : (
        <DataTable rows={rows} cols={cols} rowKey={(t) => t.key} href={href} go={go} initial={{ id: 'updated', dir: -1 }} caption={uiText("Sessions across all Projects")} />
      )}
    </div>
  )
}

// ----------------------------------------------------------------------------------------------- detail

type Ranked = Trial & { rank: number | null }

function rankTrials(trials: Trial[], direction: string | undefined): Ranked[] {
  const sign = direction === 'minimize' ? 1 : -1
  const valued = trials.filter((t) => typeof t.primaryValue === 'number' && Number.isFinite(t.primaryValue)).sort((a, b) => ((a.primaryValue as number) - (b.primaryValue as number)) * sign)
  const rank = new Map(valued.map((t, i) => [t.runId, i + 1]))
  return trials.map((t) => ({ ...t, rank: rank.get(t.runId) ?? null }))
}

function Counters({ trials }: { trials: Trial[] }) {
  const language = useLanguage()
  const n = (p: Phase) => trials.filter((t) => phaseOf(t) === p).length
  return (
    <dl className="lib-counters">
      <MetricTile label={translate(language, 'Queued', '排队中')} value={String(n('queued'))} />
      <MetricTile label={translate(language, 'Running', '运行中')} value={String(n('running'))} />
      <MetricTile label={translate(language, 'Done', '已完成')} value={String(n('done'))} />
      <MetricTile label={translate(language, 'Failed', '失败')} value={String(n('failed'))} />
    </dl>
  )
}

function StatusMatrix({ trials, projectId }: { trials: Trial[]; projectId: string }) {
  return (
    <ul className="lib-matrix" aria-label={uiText("Status of each trial, in sequence order")}>
      {trials.map((t) => {
        const p = PHASE[phaseOf(t)]
        const label = `${t.role === 'baseline' ? uiText('Baseline') : uiTemplate('Trial {0}', [t.sequence])}: ${uiText(p.word)}, ${uiText('verdict')} ${uiValue(t.verdict)}${t.isCurrentLeader ? uiText(', current leader') : ''}`
        return (
          <li key={t.runId}>
            <a className={`lib-cell is-${phaseOf(t)}${t.isCurrentLeader ? ' is-leader' : ''}`} href={routeHref({ view: 'run', id: projectId, run: t.runId })} title={`${label}. ${t.hypothesis}`} aria-label={label}>
              <Glyph kind={p.glyph} signal={p.signal} />
              <span className="mono">{t.role === 'baseline' ? 'B' : t.sequence}</span>
            </a>
          </li>
        )
      })}
    </ul>
  )
}

function Ranking({ trials, direction, projectId, go }: { trials: Trial[]; direction?: string; projectId: string; go: (href: string) => void }) {
  const language = useLanguage()
  const tr = (en: string, zh: string) => translate(language, en, zh)
  const rows = useMemo(() => rankTrials(trials, direction), [trials, direction])
  const href = (t: Ranked) => routeHref({ view: 'run', id: projectId, run: t.runId })
  const cols: Col<Ranked>[] = [
    { id: 'rank', label: tr('Rank', '排名'), align: 'r', sort: (t) => t.rank, render: (t) => t.rank ?? '—' },
    {
      id: 'trial',
      label: tr('Trial', '试验'),
      rowHeader: true,
      sort: (t) => t.sequence,
      render: (t) => (
        <>
          <a href={href(t)}>{t.role === 'baseline' ? tr('Baseline', '基线') : language === 'zh' ? `试验 ${t.sequence}` : uiTemplate("Trial {0}", [t.sequence])}</a>
          {t.isCurrentLeader && <span className="faint small">{tr('current leader', '当前最佳')}</span>}
        </>
      ),
    },
    { id: 'hyp', label: tr('Hypothesis', '假设'), render: (t) => <span className="lib-hyp">{t.hypothesis}</span> },
    { id: 'status', label: tr('Status', '状态'), sort: (t) => t.status, render: (t) => uiText(t.status) },
    { id: 'verdict', label: tr('Verdict', '判决'), sort: (t) => t.verdict, render: (t) => <span className="mono small">{uiValue(t.verdict)}</span> },
    { id: 'value', label: tr('Objective value', '目标值'), align: 'r', sort: (t) => t.primaryValue, render: (t) => num(t.primaryValue, 4) },
    { id: 'delta', label: tr('vs baseline', '相对基线'), align: 'r', sort: (t) => t.objectiveImprovementVsBaseline, render: (t) => num(t.objectiveImprovementVsBaseline, 4) },
  ]
  return <DataTable rows={rows} cols={cols} rowKey={(t) => t.runId} href={href} go={go} initial={{ id: 'rank', dir: 1 }} caption={uiText("Trials ranked by the Session objective")} />
}

const profile = (c: NeighborConfig) => c.signalProfile ?? '—'

function Neighborhood({ project }: { project: ProjectSnapshot }) {
  const language = useLanguage()
  const tr = (en: string, zh: string) => translate(language, en, zh)
  const nb = project.portfolioExplorer?.parameterNeighborhood
  const data = nb?.validation
  const configs = data?.configurations ?? []
  if (!project.portfolioExplorer) {
    return <p className="muted">{tr('This Project has no Portfolio Run, so no parameter neighborhood is published. Factor and Event Study lanes publish none.', '此项目没有组合运行记录，因此没有发布参数邻域。因子和事件研究方向不会发布此信息。')}</p>
  }
  if (!nb || nb.available === false || configs.length === 0) {
    return <p className="muted">{tr('The Portfolio Run does not publish a parameter neighborhood', '组合运行没有发布参数邻域')} (<span className="mono">{uiText("parameterNeighborhood.available")}</span> {tr('is false or its configuration list is empty', '为 false 或配置列表为空')}).</p>
  }
  const agg = data?.aggregate
  const cols: Col<NeighborConfig>[] = [
    { id: 'id', label: tr('Configuration', '配置'), rowHeader: true, sort: (c) => c.id, render: (c) => <><span className="mono small" translate="no">{c.id}</span>{c.isBase && <span className="faint small">{tr('selected base', '选定基准')}</span>}</> },
    { id: 'profile', label: tr('Signal profile', '信号配置'), sort: (c) => c.signalProfile ?? null, render: (c) => profile(c) },
    { id: 'band', label: tr('No-trade band', '不交易区间'), align: 'r', sort: (c) => c.noTradeOneWay ?? null, render: (c) => num(c.noTradeOneWay, 2) },
    { id: 'sharpe', label: uiText("Net Sharpe"), align: 'r', sort: (c) => c.netSharpe ?? null, render: (c) => num(c.netSharpe, 2) },
    { id: 'delta', label: tr('vs base', '相对基准'), align: 'r', sort: (c) => c.netSharpeDeltaVsBase ?? null, render: (c) => num(c.netSharpeDeltaVsBase, 2) },
    { id: 'ret', label: tr('Total return', '总收益'), align: 'r', sort: (c) => c.totalReturn ?? null, render: (c) => ret(c.totalReturn) },
    { id: 'turn', label: tr('Turnover / yr', '年换手率'), align: 'r', sort: (c) => c.annualizedOneWayTurnover ?? null, render: (c) => `${num(c.annualizedOneWayTurnover, 1)}x` },
    { id: 'cost', label: tr('Cost drag', '成本拖累'), align: 'r', sort: (c) => c.totalCostDrag ?? null, render: (c) => pct(c.totalCostDrag, 2) },
  ]
  return (
    <>
      <p className="small">
        {plural(nb.policy?.configurationCount ?? configs.length, 'predeclared configuration')}{uiText(" around the selected base, validation split, role")}{' '}
        <span className="mono">{coreWord(nb.policy?.role)}</span>{uiText(". The other configurations are context only and never enter selection.")}{agg && <> {pct(agg.positiveNetSharpeRate, 0)}{uiText(" have a positive net Sharpe; ")}{pct(agg.signAgreementWithBaseRate, 0)}{uiText(" share the base sign.")}</>}
      </p>
      <DataTable rows={configs} cols={cols} rowKey={(c) => c.id} initial={{ id: 'sharpe', dir: -1 }} caption={uiText("Parameter neighborhood, validation split")} />
      <p className="small lib-after">
        <a href={routeHref({ view: 'portfolio', id: project.id })}>{uiText("Open the Portfolio page")}</a>{uiText(" for the matrix and the test audit.")}</p>
    </>
  )
}

function SessionView({ project, session, go }: { project: ProjectSnapshot; session: SessionSnapshot; go: (href: string) => void }) {
  const language = useLanguage()
  const tr = (en: string, zh: string) => translate(language, en, zh)
  const m = matrixOf(session)
  const trials = trialsOf(session)
  const s = sessionOf(session)
  const fam = session.selectionIntegrity?.researchFamily
  return (
    <>
      <p className="muted small">{uiText("Session ")}<span className="mono" translate="no">{s.id}</span> · {s.status ? uiText(s.status) : uiText("status not published")}{uiText(" · Study ")}<span className="mono" translate="no">{s.studyId}</span>
        {m?.objective && <>{uiText(" · objective: ")}{m.objective.direction ?? '—'} <span className="mono" translate="no">{m.objective.metric ?? '—'}</span>{typeof m.objective.minimumImprovement === 'number' && <>{uiText(", minimum improvement ")}{m.objective.minimumImprovement}</>}</>}
      </p>
      {trials.length === 0 ? (
        <Empty>{tr('This Session has no recorded trials yet.', '此会话还没有记录试验。')}</Empty>
      ) : (
        <>
          <Section title={tr('Counters', '试验计数')} id="tn-counters" caption={tr("Counted from each trial's recorded status.", '根据每次试验记录的状态计数。')}>
            <Counters trials={trials} />
            <p className="muted small">
              {tr('Counted from finished trials.', '根据已完成的试验计数。')}
              <Info label={tr('About the counters', '关于计数')}>
                <p>
                  {tr('Trials are written when they finish, so Queued and Running stay at 0 unless the server publishes a live queue.', '试验完成后才会记录，因此除非服务端发布实时队列，排队中和运行中数量会保持为零。')}
                  {m?.scope && m.scope.omittedCandidateTrials > 0 && <> {language === 'zh' ? `此视图省略了 ${m.scope.omittedCandidateTrials} 次候选试验（上限 ${m.scope.trialLimit}）。` : uiTemplate("{0} candidate trials are omitted from this view (limit {1}).", [m.scope.omittedCandidateTrials, m.scope.trialLimit])}</>}
                  {fam && <> {language === 'zh' ? `此研究族共计 ${fam.totalExecutions} 次执行。` : uiTemplate("{0} executions are counted in this research family.", [fam.totalExecutions])}</>}
                </p>
              </Info>
            </p>
          </Section>
          <Section title={tr('Trial status', '试验状态')} id="tn-matrix" caption={tr('One cell per trial; B is the baseline, a ringed cell the leader.', '每格代表一次试验；B 为基线，带圆环的是当前最佳。')}>
            <StatusMatrix trials={trials} projectId={project.id} />
          </Section>
          <Section title={tr('Ranked values', '结果排名')} id="tn-ranking" caption={tr('Ordered by the Session objective; in-sample on the selection split.', '按会话目标排序，使用选择数据集上的样本内结果。')}>
            <Ranking trials={trials} direction={m?.objective?.direction} projectId={project.id} go={go} />
          </Section>
        </>
      )}
    </>
  )
}

function Detail({ workspace, id, go }: { workspace: WorkspaceSummary | null; id: string; go: (href: string) => void }) {
  const language = useLanguage()
  const tr = (en: string, zh: string) => translate(language, en, zh)
  const all = useAllProjects(workspace)
  const item = all.find((l) => l.summary.id === id)
  const [chosen, setChosen] = useState('')
  if (!workspace || (item && item.state === 'loading')) return <div className="pg"><Loading label={uiText("Loading…")} minHeight={240} /></div>
  if (!item) return <div className="pg"><Notice kind="error" label={uiText("Error")} title={uiText("Unknown Project.")} subtitle={id} /><p><a href={routeHref({ view: 'tuning' })}>{uiText("Back to tuning tasks")}</a></p></div>
  const project = item.project
  if (!project) return <div className="pg"><Notice kind="error" label={uiText("Error")} title={uiText("Could not load this Project")} subtitle={id} /></div>
  const sessions = project.sessions
  const session = sessions.find((s) => sessionOf(s).id === chosen) ?? sessions[0]
  return (
    <div className="pg">
      <PageHead icon="tuning" micro="TUNING" title={`${tr('Tuning', '调优')} · ${project.name}`} lede={language === 'zh' ? `${sessions.length} 个会话。仅供查看。` : uiTemplate("{0}. Read-only.", [plural(sessions.length, 'Session')])} info={<p>{tr('The per-trial view reads the Session decision matrix; nothing is run or changed from here.', '逐次试验视图读取会话决策矩阵；此处不会运行或修改内容。')}</p>} />
      {sessions.length > 1 && (
        <label className="lib-field">
          <span>{tr('Session', '会话')}</span>
          <select value={sessionOf(session).id} onChange={(e) => setChosen(e.target.value)}>
            {sessions.map((s) => <option key={sessionOf(s).id} value={sessionOf(s).id}>{sessionOf(s).id} ({uiValue(sessionOf(s).status)})</option>)}
          </select>
        </label>
      )}
      {session ? <SessionView project={project} session={session} go={go} /> : <Empty>{tr('This Project has no Session, so there is no tuning task to show.', '此项目没有会话，因此没有可显示的调优任务。')}</Empty>}
      <Section title={tr('Parameter neighborhood', '参数邻域')} id="tn-neighborhood" caption={tr('Published by the Portfolio lane only.', '仅由组合研究方向发布。')}>
        <Neighborhood project={project} />
      </Section>
      <Section title={tr('Not available', '暂不可用')} id="tn-na" caption={tr('The reference tuning view shows these; this Studio does not, and says so instead of drawing something.', '以下功能在当前 Studio 中不可用。')}>
        <ul className="lib-na">
          <li><strong>{tr('Per-trial curves.', '各次试验曲线。')}</strong> <span className="muted">{tr('Session trials publish one objective value and a metric set each, not an equity or IC time series, so no overlaid curve can be drawn.', '会话试验只发布目标值和指标集，没有净值或 IC 时间序列，因此无法绘制叠加曲线。')}</span></li>
          <li><strong>{tr('Live queue and parallel workers.', '实时队列和并行任务。')}</strong> <span className="muted">{tr('Trials are recorded after they finish; there is no queued or running state in the payload.', '试验完成后才记录，数据中没有排队中或运行中状态。')}</span></li>
          <li><strong>{tr('Apply best parameters.', '应用最佳参数。')}</strong> <span className="muted">{tr('Studio is read-only here. Selecting a trial is a recorded Session step, not a button.', '此处为只读。选择试验是会话中记录的步骤。')}</span></li>
        </ul>
      </Section>
    </div>
  )
}

export function TuningPage({ workspace, id, go }: { workspace: WorkspaceSummary | null; id?: string; go: (href: string) => void }) {
  return id ? <Detail workspace={workspace} id={id} go={go} /> : <Index workspace={workspace} go={go} />
}
