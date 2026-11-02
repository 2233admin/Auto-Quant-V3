import { translate, uiTemplate, uiText, useLanguage } from '../i18n'
import { useMemo, useState } from 'react'
import type { WorkspaceSummary } from '../api'
import { num, plural, when } from '../format'
import { routeHref } from '../route'
import { byNewest, dayOf, flatRuns, useAllProjects, type FlatRun } from './data'
import { DataTable, type Col } from './DataTable'
import { Empty, Field, LoadNote, PageHead, uniq } from './parts'
const duration = (ms: number | null | undefined) => (typeof ms === 'number' ? (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`) : '—')
const key = (r: FlatRun) => `${r.project.id}/${r.run.id}`

export function RunHistory({ workspace, go }: { workspace: WorkspaceSummary | null; go: (href: string) => void }) {
  const language = useLanguage()
  const t = (en: string, zh: string) => translate(language, en, zh)
  const all = useAllProjects(workspace)
  const rows = useMemo(() => flatRuns(all).sort((a, b) => byNewest(a.run, b.run)), [all])
  const [q, setQ] = useState('')
  const [lane, setLane] = useState('')
  const [status, setStatus] = useState('')
  const [project, setProject] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [picked, setPicked] = useState<string[]>([])

  const shown = rows.filter(
    (r) =>
      (!lane || r.lane === lane) &&
      (!status || r.run.status === status) &&
      (!project || r.project.id === project) &&
      (!from || dayOf(r.run.startedAt) >= from) &&
      (!to || dayOf(r.run.startedAt) <= to) &&
      (!q || `${r.run.id} ${r.run.studyId} ${r.run.primaryMetric} ${r.run.subject.name} ${r.project.name}`.toLowerCase().includes(q.toLowerCase())),
  )

  const toggle = (k: string) => setPicked((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : prev.length >= 2 ? [prev[1], k] : [...prev, k]))
  const two = picked.length === 2 ? picked.map((k) => rows.find((r) => key(r) === k)).filter((r): r is FlatRun => !!r) : []
  const sameProject = two.length === 2 && two[0].project.id === two[1].project.id
  // Older Run is A (before), newer is B (after), as on the Project page.
  const [a, b] = sameProject ? [...two].sort((x, y) => x.run.startedAt.localeCompare(y.run.startedAt)) : []

  const href = (r: FlatRun) => routeHref({ view: 'run', id: r.project.id, run: r.run.id })
  const cols: Col<FlatRun>[] = [
    {
      id: 'pick',
      label: t('Select', '选择'),
      render: (r) => (
        <input type="checkbox" aria-label={uiTemplate("Select {0} for comparison", [r.run.id])} checked={picked.includes(key(r))} onChange={() => toggle(key(r))} />
      ),
    },
    {
      id: 'run',
      label: t('Run', '运行'),
      rowHeader: true,
      sort: (r) => r.run.id,
      render: (r) => (
        <>
          <a href={href(r)} className="mono" translate="no" title={r.run.id}>{r.run.id.replace(/^.*-/, '')}</a>
          <span className="faint small mono" translate="no">{r.run.subject.name} · {r.run.studyId}</span>
        </>
      ),
    },
    { id: 'project', label: t('Project', '项目'), sort: (r) => r.project.name, render: (r) => <span translate="no">{r.project.name}</span> },
    { id: 'lane', label: t('Lane', '研究方向'), sort: (r) => r.lane, render: (r) => r.lane },
    { id: 'status', label: t('Status', '状态'), sort: (r) => r.run.status, render: (r) => r.run.status },
    { id: 'started', label: t('Started (UTC)', '开始时间 (UTC)'), sort: (r) => r.run.startedAt, render: (r) => <span className="mono">{when(r.run.startedAt)}</span> },
    { id: 'dur', label: t('Duration', '用时'), align: 'r', sort: (r) => r.run.durationMs ?? null, render: (r) => duration(r.run.durationMs) },
    { id: 'metric', label: t('Metric', '指标'), sort: (r) => r.run.primaryMetric, render: (r) => <span className="mono small" translate="no">{r.run.primaryMetric}</span> },
    { id: 'value', label: t('Value', '数值'), align: 'r', sort: (r) => r.run.primaryValue, render: (r) => num(r.run.primaryValue, 4) },
    { id: 'errors', label: t('Errors', '错误'), align: 'r', sort: (r) => (r.run.errors ?? []).length, render: (r) => (r.run.errors ?? []).length },
  ]
  const reset = () => {
    setQ('')
    setLane('')
    setStatus('')
    setProject('')
    setFrom('')
    setTo('')
  }
  const filtered = !!(q || lane || status || project || from || to)
  return (
    <div className="pg">
      <PageHead
        title={t('Run history', '运行历史')}
        lede={language === 'zh' ? `共 ${rows.length} 条运行记录，来自 ${new Set(rows.map((r) => r.project.id)).size} 个项目，按时间倒序排列。选择同一项目的两条记录进行比较。` : uiTemplate("{0} across {1}, newest first. Tick two Runs of one Project to compare them.", [plural(rows.length, 'immutable Run'), plural(new Set(rows.map((r) => r.project.id)).size, 'Project')])}
      />
      <LoadNote all={all} />
      <div className="lib-filters">
        <Field label={t('Search', '搜索')}>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Run, Study, metric', '运行、研究或指标')} />
        </Field>
        <Field label={t('Lane', '研究方向')}>
          <select value={lane} onChange={(e) => setLane(e.target.value)}>
            <option value="">{t('All lanes', '全部方向')}</option>
            {uniq(rows.map((r) => r.lane)).map((v) => <option key={v}>{v}</option>)}
          </select>
        </Field>
        <Field label={t('Status', '状态')}>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t('All statuses', '全部状态')}</option>
            {uniq(rows.map((r) => r.run.status)).map((v) => <option key={v}>{v}</option>)}
          </select>
        </Field>
        <Field label={t('Project', '项目')}>
          <select value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">{t('All Projects', '全部项目')}</option>
            {uniq(rows.map((r) => r.project.id)).map((id) => <option key={id} value={id}>{rows.find((r) => r.project.id === id)?.project.name ?? id}</option>)}
          </select>
        </Field>
        <details className="lib-more">
          <summary>
            {t('Dates', '日期')}
            {(from || to) && <span className="lib-dot" aria-label={uiText("A date filter is set")} />}
          </summary>
          <div className="lib-more-panel">
            <Field label={t('From (UTC)', '起始日期 (UTC)')} visible>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label={t('To (UTC)', '结束日期 (UTC)')} visible>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
        </details>
        {filtered && <button type="button" className="btn" onClick={reset}>{t('Clear filters', '清除筛选')}</button>}
        <span className="faint small lib-count" role="status">{language === 'zh' ? `显示 ${shown.length} / ${rows.length} 条运行记录` : uiTemplate("{0} of {1} Runs", [shown.length, rows.length])}</span>
      </div>
      <div className="lib-bar" role="status">
        {a && b ? (
          <a className="btn" href={routeHref({ view: 'compare', id: a.project.id, a: a.run.id, b: b.run.id })}>{t('Compare 2 Runs', '比较两次运行')}</a>
        ) : picked.length === 2 ? (
          <span className="sig small">{t('Compare needs two Runs of the same Project.', '比较需要选择同一项目的两次运行。')}</span>
        ) : (
          <span className="faint small">{language === 'zh' ? `已选择 ${picked.length}/2` : uiTemplate("{0}/2 selected", [picked.length])}</span>
        )}
        {picked.length > 0 && <button type="button" className="btn" onClick={() => setPicked([])}>{t('Clear selection', '清除选择')}</button>}
      </div>
      {shown.length === 0 ? (
        <Empty>{rows.length === 0 ? t('No Run was found in this Workspace.', '此工作区没有运行记录。') : t('No Run matches these filters.', '没有符合筛选条件的运行记录。')}</Empty>
      ) : (
        <DataTable rows={shown} cols={cols} rowKey={key} href={href} go={go} initial={{ id: 'started', dir: -1 }} caption={uiText("Runs across all Projects")} selected={(r) => picked.includes(key(r))} />
      )}
    </div>
  )
}
