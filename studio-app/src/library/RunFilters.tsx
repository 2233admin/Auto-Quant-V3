import { uiText } from '../i18n'
import type { HistoryRun } from './runHistoryApi'
import { Field, uniq } from './parts'

export type Filters = { q: string; object: string; lane: string; verdict: string; project: string; from: string; to: string }
export const emptyFilters: Filters = { q: '', object: '', lane: '', verdict: '', project: '', from: '', to: '' }

export function matchesRun(r: HistoryRun, f: Filters): boolean {
  const text = `${r.id} ${r.studyId} ${r.primaryMetric} ${r.subject} ${r.project.name} ${r.sourceHash}`.toLowerCase()
  const pairs = [[f.object, r.objectKind], [f.lane, r.lane], [f.verdict, r.verdict], [f.project, r.project.id]]
  if (pairs.some(([filter, value]) => filter && filter !== value)) return false
  const day = r.startedAt.slice(0, 10)
  if (f.from && day < f.from) return false
  if (f.to && day > f.to) return false
  return text.includes(f.q.toLowerCase())
}

export function RunFilters({ rows, value: f, onChange }: { rows: HistoryRun[]; value: Filters; onChange: (f: Filters) => void }) {
  const set = (key: keyof Filters, value: string) => onChange({ ...f, [key]: value })
  const selects = [
    { key: 'object' as const, label: 'Object kind', all: 'All objects', values: uniq(rows.map(r => r.objectKind)) },
    { key: 'lane' as const, label: 'Lane', all: 'All lanes', values: uniq(rows.map(r => r.lane)) },
    { key: 'verdict' as const, label: 'Verdict', all: 'All verdicts', values: uniq(rows.map(r => r.verdict)) },
    { key: 'project' as const, label: 'Project', all: 'All Projects', values: uniq(rows.map(r => r.project.id)) },
  ]
  return <div className="lib-filters">
    <Field label={uiText('Search')}><input aria-label={uiText('Search')} type="search" value={f.q} onChange={e => set('q', e.target.value)} placeholder={uiText('Run, Study, metric')} /></Field>
    {selects.map(s => <Field key={s.key} label={uiText(s.label)}><select aria-label={uiText(s.label)} value={f[s.key]} onChange={e => set(s.key, e.target.value)}>
      <option value="">{uiText(s.all)}</option>{s.values.map(v => <option key={v} value={v}>{s.key === 'project' ? rows.find(r => r.project.id === v)?.project.name : uiText(v)}</option>)}
    </select></Field>)}
    <Field label={uiText('From (UTC)')} visible><input type="date" value={f.from} onChange={e => set('from', e.target.value)} /></Field>
    <Field label={uiText('To (UTC)')} visible><input type="date" value={f.to} onChange={e => set('to', e.target.value)} /></Field>
    {Object.values(f).some(Boolean) && <button className="btn" onClick={() => onChange(emptyFilters)}>{uiText('Clear filters')}</button>}
  </div>
}
