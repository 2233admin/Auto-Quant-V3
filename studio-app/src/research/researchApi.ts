import { useEffect, useState } from 'react'
import { getJson, type ResearchState } from '../api'

export type { ResearchState, ResearchSummary } from '../api'

/**
 * Read model of a Project's Shinka research direction (`/api/v1/project/research`) and the Workspace library
 * (`/api/v1/research-library`), built by `autoquant/studio_research.py`. Every visibility rule, the check ledger and
 * the noise-frontier line are computed on the server; these pages only lay them out.
 */

export type LedgerRow = {
  id: string
  role: 'gate' | 'context'
  state: 'pass' | 'fail' | 'n.a.' | 'withheld' | 'not-computed' | 'info' | 'none' | 'sealed' | 'opened' | 'confirmed' | 'unconfirmed'
  value: number | string | boolean | null
  threshold: string | null
  reference?: number | null
}

export type Evidence = Record<string, unknown>

export type ResearchExperiment = {
  id: string
  created: string
  n_evaluated: number
  n_probed: number
  best_is_score: number | null
  spend_usd: number
  spend_known: boolean
  first_trial: string | null
  last_trial: string | null
  skeptic?: Evidence | null
  evaluatorHash?: string
  dataHash?: string
  plan?: { domain: string; claim: string; rationale: string; rule: { kind: string; version: number; thresholds?: Record<string, number> } } | null
}

export type ResearchHypothesis = {
  id: string
  title: string
  status: string
  created: string
  body: string
  experiments: ResearchExperiment[]
  verdict: { label: string; reason: string; evidence: Evidence; created: string } | null
  confirmation: Evidence | null
  ledger: LedgerRow[]
}

export type TrialPoint = { n: number; time: string; hypothesis: string; experiment: string; generation: number; program: string; score: number | null; record: boolean; bar: number }

export type ResearchEvent = { time: string; hypothesis: string; experiment: string; event: string; note: string | null; withheld: boolean }

export type Frontier = {
  trials: number
  programs: number
  failed: number
  probes: number
  best: number | null
  bar: number | null
  gap: number | null
  clears: boolean | null
  byHypothesis: Record<string, number>
}

export type Direction = {
  direction: string
  created: string
  budget_usd: number | null
  spend_usd: number
  unknown_cost_runs: number
  trials: number
  lockbox: { opened: boolean; start?: string; n_total: number; n_dev: number } | null
  hypotheses: ResearchHypothesis[]
  trial_points: TrialPoint[]
  probes: number
  events: ResearchEvent[]
  rounds: { state: string; pending: { kind: string; do: string }[] } & Record<string, unknown>
  frontier: Frontier
}

export type ProjectResearch = {
  kind: 'autoquant-studio-project-research'
  projectId: string
  state: ResearchState
  reason: string | null
  demo: string | null
  research: Direction | null
}

export type KnowledgeLibrary = {
  index: string
  log: string
  pending: string[]
  pages: { name: string; text: string }[]
  findings: string[]
  sources: { agent: number; human: number; unrecorded: number; lastAdded: string | null }
  demo: string | null
}

export type ResearchLibrary = { kind: 'autoquant-studio-research-library'; state: ResearchState; reason: string | null; library: KnowledgeLibrary | null }

export type Loaded<T> = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; data: T }

/** One read-only payload, refetched when `tick` (the shell's refresh time) changes; the server answers 304 when unchanged. */
export function useResearchJson<T>(url: string | null, tick: Date | null): Loaded<T> {
  const [load, setLoad] = useState<Loaded<T>>({ state: 'loading' })
  useEffect(() => {
    if (!url) return
    const controller = new AbortController()
    getJson<T>(url, controller.signal)
      .then((data) => setLoad({ state: 'ready', data }))
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setLoad((prev) => (prev.state === 'ready' ? prev : { state: 'error', message: reason instanceof Error ? reason.message : String(reason) }))
      })
    return () => controller.abort()
  }, [url, tick])
  return load
}

export const researchUrl = (id: string) => `/api/v1/project/research?id=${encodeURIComponent(id)}`
export const LIBRARY_URL = '/api/v1/research-library'
