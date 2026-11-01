import { actionCall } from './client'
import type { ActionsBootstrap, Job } from './types'
import { isTerminal } from './types'
import type { SelectionIntegrity } from '../api'

export type DatasetChoice = { path: string; id: string; sha256: string; assets: string[]; provider: string; adjustment: string; frequency: string }
export type DatasetChoices = { datasets: DatasetChoice[]; unavailable: { path: string; reason: string }[]; stagingCommand: string; stagingNote: string }
export type IdeaBinding = { hypothesis: string; hypothesisSha256: string; verdictPolicy: string; jobId?: string; runId?: string; actionId?: string; trialHypothesis?: string }
export type Idea = IdeaBinding & { bound: boolean; frozen: boolean; initialAuthored: boolean; request: { horizonPolicy: { primaryForwardBars: number }; factorPolicy: { predictionAssets: string[] } } | null; bindings: IdeaBinding[]; jobs: Job[]; evidence: { runId: string; researchFamily: SelectionIntegrity['researchFamily']; selectionAdjustment: SelectionIntegrity['selectionAdjustment'] } | null }
export const getIdea = (b: ActionsBootstrap, id: string) => actionCall<Idea>(b, 'GET', `/api/v1/idea?project=${encodeURIComponent(id)}`)
export const getDatasets = (b: ActionsBootstrap) => actionCall<DatasetChoices>(b, 'GET', '/api/v1/idea-datasets')
export async function waitJob(b: ActionsBootstrap, id: string, update?: (job: Job) => void): Promise<Job> {
  for (;;) {
    const job = await actionCall<Job>(b, 'GET', `/api/v1/jobs/${encodeURIComponent(id)}`)
    update?.(job)
    if (isTerminal(job.status)) return job
    await new Promise((resolve) => window.setTimeout(resolve, 450))
  }
}
export function jobError(job: Job): string {
  const result = job.result as { error?: { message?: string }; errors?: { message?: string }[] } | null
  return result?.error?.message ?? result?.errors?.[0]?.message ?? (job.stderrTail || job.stdoutTail || `Action ${job.status}`).slice(-1600)
}
