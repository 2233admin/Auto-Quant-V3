import { useEffect, useState } from 'react'
import { getJson } from '../api'
import type { RankSummary, FactorCumulativePoint } from '../api'

export type Protocol = Record<string, unknown>
export type HistoryRun = {
  id: string; project: { id: string; name: string }; studyId: string; subject: string
  objectKind: string; lane: string; verdict: string; status: string
  primaryMetric: string; primaryValue: number | null; startedAt: string; durationMs: number
  validationHeadlines?: Partial<Record<'netTotalReturn' | 'netAnnualReturn' | 'maxDrawdown' | 'annualVolatility', number | null>>
  sourceHash: string; datasetId: string; costModelId: string | null
  testAuditVisible: boolean; protocol: Protocol
}
export type HistoryPage = { rows: HistoryRun[]; total: number; diagnostics: { message: string }[] }
export type Difference = { field: string; reason: string; a: unknown; b: unknown }
export type FactorComparison = {
  protocol: { testRole?: string }; summary: { validation: RankSummary; testAudit?: RankSummary | null }
  points: FactorCumulativePoint[]
}
export type Comparison = {
  status: 'comparable' | 'not-comparable'; differences: Difference[]
  a: HistoryRun; b: HistoryRun; factors?: [FactorComparison, FactorComparison]
}
export const runKey = (r: HistoryRun) => `${r.project.id}/${r.id}`
export const compareUrl = (a: HistoryRun, b: HistoryRun) => `/api/v1/run-compare?${new URLSearchParams({ project: a.project.id, a: a.id, projectB: b.project.id, b: b.id })}`

/** Hide a previous response immediately when its request identity changes. */
export function useRead<T>(url: string | undefined) {
  const [state, setState] = useState<{ url: string; data?: T; error?: string }>()
  useEffect(() => {
    if (!url) return
    const controller = new AbortController()
    getJson<T>(url, controller.signal).then(data => { if (!controller.signal.aborted) setState({ url, data }) }).catch((e: unknown) => {
      if (!controller.signal.aborted) setState({ url, error: String(e) })
    })
    return () => controller.abort()
  }, [url])
  return state?.url === url ? state : undefined
}

/** Each response is capped at 200 rows; load every page, never silently truncate history. */
export function useHistory(revision: string) {
  const [state, setState] = useState<{ rows: HistoryRun[]; error?: string; warnings?: string; loading: boolean }>({ rows: [], loading: true })
  useEffect(() => {
    const controller = new AbortController()
    setState({ rows: [], loading: true })
    void (async () => {
      const rows: HistoryRun[] = []
      const warnings = new Set<string>()
      let total = 1
      while (rows.length < total) {
        const page = await getJson<HistoryPage>(`/api/v1/runs?offset=${rows.length}&limit=200`, controller.signal)
        total = page.total
        rows.push(...page.rows)
        page.diagnostics.forEach(d => warnings.add(d.message))
        if (!page.rows.length) break
      }
      if (!controller.signal.aborted) setState({ rows, loading: false, warnings: [...warnings].join('; ') })
    })().catch((e: unknown) => { if (!controller.signal.aborted) setState({ rows: [], loading: false, error: String(e) }) })
    return () => controller.abort()
  }, [revision])
  return state
}
