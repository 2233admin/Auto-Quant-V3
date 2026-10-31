import { useEffect, useState } from 'react'
import { getJson, type ProjectResponse, type ProjectSnapshot, type ProjectSummary, type RunRow } from '../api'
import { Glyph } from '../design/icons'
import { num, plural, when } from '../format'
import { routeHref } from '../route'
import { verification } from '../shell/Rail'
import { buildVerdict, type Verdict } from '../pages/FactorEvidence'
import { pickIntegrity } from './TrialCounter'
import './components.css'

type Detail = { state: 'loading' } | { state: 'error' } | { state: 'ready'; project: ProjectSnapshot }

// Full Project snapshots are large, so they are fetched once per (Project, Run count, latest Run) and shared.
const cache = new Map<string, ProjectSnapshot>()

/** Loads the Project snapshot behind a card. Refetches only when the summary says a Run was added. */
function useDetail(p: ProjectSummary): Detail {
  const key = `${p.id}|${p.runCount}|${p.latestRunAt ?? ''}`
  const [detail, setDetail] = useState<Detail>(() => {
    const hit = cache.get(key)
    return hit ? { state: 'ready', project: hit } : { state: 'loading' }
  })
  useEffect(() => {
    const hit = cache.get(key)
    if (hit) {
      setDetail({ state: 'ready', project: hit })
      return
    }
    const controller = new AbortController()
    getJson<ProjectResponse>(`/api/v1/project?id=${encodeURIComponent(p.id)}`, controller.signal)
      .then((body) => {
        const project = body.projects[0]
        if (!project) return setDetail({ state: 'error' })
        cache.set(key, project)
        setDetail({ state: 'ready', project })
      })
      .catch(() => {
        if (!controller.signal.aborted) setDetail({ state: 'error' })
      })
    return () => controller.abort()
  }, [key, p.id])
  return detail
}

const VERDICT: Record<Verdict, { word: string; glyph: 'supported' | 'refuted' | 'inconclusive'; signal: boolean }> = {
  pass: { word: 'Pass', glyph: 'supported', signal: false },
  fail: { word: 'Fail', glyph: 'refuted', signal: true },
  inconclusive: { word: 'Inconclusive', glyph: 'inconclusive', signal: false },
}

/** Study primary-metric values of the latest Run's Study, oldest first. Failed Runs have no value and are skipped. */
function series(project: ProjectSnapshot, latest: RunRow): number[] {
  return project.runs
    .filter((r) => r.studyId === latest.studyId && r.primaryMetric === latest.primaryMetric && typeof r.primaryValue === 'number' && Number.isFinite(r.primaryValue))
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((r) => r.primaryValue as number)
}

const W = 120
const H = 36
const PAD = 4

/** Plain SVG line: no axes, scaled to its own min and max, last point marked. Scaling only; no statistics. */
function Sparkline({ values, label }: { values: number[]; label: string }) {
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const x = (i: number) => (values.length === 1 ? W / 2 : PAD + (i * (W - 2 * PAD)) / (values.length - 1))
  const y = (v: number) => (hi === lo ? H / 2 : H - PAD - ((v - lo) * (H - 2 * PAD)) / (hi - lo))
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const last = values.length - 1
  return (
    <svg className="pc-spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {values.length > 1 && <path d={d} />}
      <circle className="last" cx={x(last)} cy={y(values[last])} r="3.5" />
    </svg>
  )
}

export function ProjectCard({ p }: { p: ProjectSummary }) {
  const detail = useDetail(p)
  const look = verification(p.valid)
  const project = detail.state === 'ready' ? detail.project : null
  const latest = project && project.runs.length > 0 ? [...project.runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] : null
  const integrity = project ? pickIntegrity(project) : undefined
  const fam = integrity?.researchFamily
  const verdict = project?.factorExplorer ? buildVerdict(project.factorExplorer, integrity?.selectionAdjustment).verdict : null
  const values = project && latest ? series(project, latest) : []
  const split = latest?.primaryMetric.split('_')[0]
  const splitLabel = split === 'validation' || split === 'test' || split === 'train' ? split : null
  const sessions = typeof p.counts.sessions === 'number' ? p.counts.sessions : 0

  return (
    <article className="pc" aria-label={p.name}>
      <div className="pc-top">
        <a className="pc-name" href={routeHref({ view: 'project', id: p.id })} translate="no">{p.name}</a>
        <span className="faint small mono" translate="no">{p.id}</span>
      </div>
      <div className="pc-badges">
        <span className="pc-badge">
          <Glyph kind={look.glyph} signal={look.signal} />
          <span className={look.signal ? 'sig' : undefined}>{look.word}</span>
        </span>
        {verdict ? (
          <span className="pc-badge" title="Factor verdict: the server qualification stage, demoted when the selection adjustment fails.">
            <Glyph kind={VERDICT[verdict].glyph} signal={VERDICT[verdict].signal} />
            <span className={VERDICT[verdict].signal ? 'sig' : undefined}>{VERDICT[verdict].word}</span>
          </span>
        ) : (
          <span className="pc-badge faint">{detail.state === 'loading' ? 'Loading verdict' : 'No Factor verdict'}</span>
        )}
      </div>

      {p.runCount === 0 ? (
        <p className="muted small">No Runs yet. There is no primary metric to show.</p>
      ) : latest ? (
        <div className="pc-metric">
          <div className="mt">
            <span className="mt-label">
              <span className="mono" translate="no">{latest.primaryMetric}</span>
            </span>
            <span className="mt-value mono">{num(latest.primaryValue, 4)}</span>
            <span className="faint small">
              {splitLabel ? `${splitLabel} split · ` : ''}{plural(values.length, 'valued Run')}
            </span>
          </div>
          {values.length > 0 ? (
            <Sparkline values={values} label={`${latest.primaryMetric} across ${plural(values.length, 'Run')}, oldest to newest; the last point is the latest Run.`} />
          ) : (
            <span className="faint small">No valued Run</span>
          )}
        </div>
      ) : (
        <p className="muted small">{detail.state === 'error' ? 'Could not load the Run values.' : 'Loading Run values…'}</p>
      )}

      <dl className="pc-facts">
        <dt>Trials counted</dt>
        <dd className="mono">{fam ? `${fam.totalExecutions} (${fam.uniqueSourceTrials} unique)` : project ? 'no ledger' : '—'}</dd>
        <dt>Runs</dt>
        <dd className="mono">{p.runCount}</dd>
        <dt>Sessions</dt>
        <dd className="mono">{sessions}</dd>
        <dt>External holdout</dt>
        <dd>{p.externalHoldout.present ? (p.externalHoldout.status ?? 'Recorded') : 'Not run'}</dd>
        <dt>Latest Run (UTC)</dt>
        <dd className="mono">{when(p.latestRunAt)}</dd>
      </dl>
      {p.brief.headline && <p className="pc-next">{p.brief.headline}</p>}
    </article>
  )
}
