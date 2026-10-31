/** Wire types for the Studio local-action routes (docs/design/studio-local-actions.md). */

export type ActionsBootstrap = { enabled: boolean; token: string; tokenHeader: string; catalog: string }

export type CatalogSession = { session: string; available: boolean; blockedBy: string | null }
export type CatalogTarget = { project: string; activeJob: string | null; sessions: CatalogSession[] }
export type CatalogAction = {
  id: string
  label: string
  classification: string
  writes: string
  command: string
  timeoutSeconds: number
  requiresSecondConfirm: boolean
  params: {
    session: { type: string; pattern: string }
    hypothesis: { type: string; minLength: number; maxLength: number }
  }
  targets: CatalogTarget[]
}
export type Catalog = { actions: CatalogAction[] }

export type TrialInfo = {
  n: number
  m: number
  sessionTrial?: number
  familyId?: string
  adjustment?: {
    status?: string
    method?: string | null
    reason?: string | null
    passes?: boolean | null
    interpretation?: string
  } | null
  testExposureState?: string
  externalHoldoutRequired?: boolean | null
  notice?: string
}

export type Preview = {
  actionId: string
  project: string
  params: { session: string; hypothesis: string }
  argv: string[]
  display: string
  commandHash: string
  writes: string
  trial: TrialInfo
  requiresSecondConfirm: boolean
  timeoutSeconds: number
}

export type StageState = 'pending' | 'running' | 'done' | 'failed' | 'skipped'
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'timed-out'

export type Job = {
  jobId: string
  status: JobStatus
  actionId: string
  project: string
  display: string
  commandHash: string
  startedAt: string | null
  endedAt: string | null
  stageMode?: string
  stages: { id: string; label: string; state: StageState }[]
  stdoutTail: string
  stderrTail: string
  truncated: boolean
  exitCode: number | null
  result: unknown
  createdRefs: { experimentId?: string; runId?: string }
}

export const TERMINAL: JobStatus[] = ['succeeded', 'failed', 'cancelled', 'timed-out']
export const isTerminal = (status: JobStatus) => TERMINAL.includes(status)
