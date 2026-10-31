import { useEffect, useMemo, useState } from 'react'
import { getJson, type ProjectResponse, type ProjectSnapshot, type ProjectSummary, type RunRow, type SessionSnapshot, type StudyRow, type WorkspaceSummary } from '../api'

/**
 * Cross-Project reads for the library pages. The workspace summary only carries counts, so each Project snapshot is
 * fetched once per (Project, Run count, latest Run) and shared. Everything below only picks, filters and orders
 * published fields; no statistic is computed here.
 */

export type Loaded = { summary: ProjectSummary; state: 'loading' | 'error' | 'ready'; project: ProjectSnapshot | null }

const cache = new Map<string, ProjectSnapshot>()
const keyOf = (p: ProjectSummary) => `${p.id}|${p.runCount}|${p.latestRunAt ?? ''}`
const CONCURRENCY = 4

/** Every Project of the Workspace with its snapshot, loaded four at a time. A failed Project stays listed as an error. */
export function useAllProjects(workspace: WorkspaceSummary | null): Loaded[] {
  const projects = useMemo(() => workspace?.projects ?? [], [workspace])
  const sig = projects.map(keyOf).join('\n')
  const [tick, setTick] = useState(0)
  const [failed, setFailed] = useState<Set<string>>(new Set())

  useEffect(() => {
    const controller = new AbortController()
    const todo = projects.filter((p) => !cache.has(keyOf(p)))
    let next = 0
    const worker = async () => {
      while (next < todo.length && !controller.signal.aborted) {
        const p = todo[next++]
        try {
          const body = await getJson<ProjectResponse>(`/api/v1/project?id=${encodeURIComponent(p.id)}`, controller.signal)
          const snap = body.projects[0]
          if (snap) cache.set(keyOf(p), snap)
          else setFailed((prev) => new Set(prev).add(keyOf(p)))
        } catch {
          if (!controller.signal.aborted) setFailed((prev) => new Set(prev).add(keyOf(p)))
        }
        if (!controller.signal.aborted) setTick((t) => t + 1)
      }
    }
    for (let i = 0; i < Math.min(CONCURRENCY, todo.length); i++) void worker()
    return () => controller.abort()
    // The signature stands for the Project list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])

  return useMemo(
    () =>
      projects.map((summary) => {
        const project = cache.get(keyOf(summary)) ?? null
        return { summary, project, state: project ? 'ready' : failed.has(keyOf(summary)) ? 'error' : 'loading' } as Loaded
      }),
    // `tick` re-reads the module cache after each fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, failed, tick],
  )
}

export function loadState(all: Loaded[]): { loading: number; failed: number } {
  return { loading: all.filter((p) => p.state === 'loading').length, failed: all.filter((p) => p.state === 'error').length }
}

// --------------------------------------------------------------------------------------------- lanes

/** The lane a Run belongs to: an explorer that names this Run first, then the Run's own metric layer, then the Study's subject kind. */
const EXPLORERS: [keyof ProjectSnapshot, string][] = [
  ['eventStudyExplorer', 'Event Study'],
  ['bookRiskExplorer', 'Book Risk'],
  ['bookPathStressExplorer', 'Path Stress'],
  ['allocationExplorer', 'Allocation'],
  ['rlExplorer', 'RL policy'],
  ['portfolioExplorer', 'Portfolio'],
  ['factorExplorer', 'Factor'],
]
const LAYER_LANE: Record<string, string> = { factor: 'Factor', portfolio: 'Portfolio', 'rl-policy': 'RL policy' }

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : 'Other')

export function laneOfRun(project: ProjectSnapshot, run: RunRow): string {
  for (const [key, lane] of EXPLORERS) {
    const ex = project[key] as { run?: { id?: string } } | null
    if (ex?.run?.id === run.id) return lane
  }
  const layer = (run as RunRow & { metricLayers?: { kind?: string } }).metricLayers?.kind
  if (layer && LAYER_LANE[layer]) return LAYER_LANE[layer]
  const study = project.studies.find((s) => s.id === run.studyId)
  return cap(study?.subjectKind ?? run.subject.kind)
}

export const byNewest = (a: RunRow, b: RunRow) => b.startedAt.localeCompare(a.startedAt)

export type FlatRun = { project: ProjectSummary; snapshot: ProjectSnapshot; run: RunRow; lane: string }

export function flatRuns(all: Loaded[]): FlatRun[] {
  return all.flatMap((l) => (l.project ? l.project.runs.map((run) => ({ project: l.summary, snapshot: l.project as ProjectSnapshot, run, lane: laneOfRun(l.project as ProjectSnapshot, run) })) : []))
}

/** Valued primary-metric values of one Study's Runs, oldest first. */
export function studySeries(project: ProjectSnapshot, study: StudyRow, metric: string): number[] {
  return project.runs
    .filter((r) => r.studyId === study.id && r.primaryMetric === metric && typeof r.primaryValue === 'number' && Number.isFinite(r.primaryValue))
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((r) => r.primaryValue as number)
}

export const splitOf = (metric: string): string | null => {
  const s = metric.split('_')[0]
  return s === 'train' || s === 'validation' || s === 'test' ? s : null
}

export function dayOf(iso: string): string {
  return iso.slice(0, 10)
}

export function sessionOf(s: SessionSnapshot) {
  return { id: s.session?.id ?? s.id ?? '', status: s.session?.status ?? s.status ?? '', studyId: s.session?.studyId ?? s.studyId ?? '' }
}
