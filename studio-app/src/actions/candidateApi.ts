import { actionCall, ActionHttpError } from './client'
import type { ActionsBootstrap, Job, Preview } from './types'
import { isTerminal } from './types'

/**
 * Typed client for the candidate editor routes (docs/design/studio-local-actions.md, "Candidate editor and session actions").
 *   GET  /api/v1/candidate?project=<id>&session=<sid>      read the Session candidate source
 *   POST /api/v1/actions  candidate.save                   synchronous write, refuses a stale baseSha256
 *   POST /api/v1/actions  session.check | session.start   preview, then a confirmed job
 */

export const SAVE_ID = 'candidate.save'
export const CHECK_ID = 'session.check'
export const START_ID = 'session.start'

export type CandidateDoc = {
  path: string
  source: string
  sha256: string
  bytes: number
  editable: boolean
  blockedReason?: string
}

export type SaveResult = { sha256: string; bytes: number }

/** Reads need no token and work with actions off: the editor then renders the same source read-only. */
export async function getCandidate(project: string, session: string, signal?: AbortSignal): Promise<CandidateDoc> {
  const query = new URLSearchParams({ project, session })
  const response = await fetch(`/api/v1/candidate?${query}`, { signal, headers: { Accept: 'application/json' }, cache: 'no-store' })
  const body = await response.json().catch(() => null)
  if (!response.ok || body?.ok === false) {
    throw new Error(body?.error?.message ?? `${response.status} ${response.statusText}`)
  }
  const data = body?.data as CandidateDoc
  return { ...data, blockedReason: data.blockedReason ?? undefined }
}

/** True only for the stale-baseSha256 refusal (409 studio.conflict); other 409s are blocked or busy and keep their own text. */
export function isConflict(error: unknown): boolean {
  return error instanceof ActionHttpError && (error.code === 'studio.conflict' || error.issues.some((i) => i.code === 'candidate.conflict'))
}

export async function saveCandidate(
  bootstrap: ActionsBootstrap,
  project: string,
  params: { session: string; source: string; baseSha256: string },
): Promise<SaveResult> {
  return actionCall<SaveResult>(bootstrap, 'POST', '/api/v1/actions', { actionId: SAVE_ID, project, params, confirm: true })
}

/** Preview an action; the preview carries the exact command, its hash and, where it applies, the trial number. */
export function previewAction(bootstrap: ActionsBootstrap, actionId: string, project: string, params: Record<string, unknown>, signal?: AbortSignal) {
  return actionCall<Preview>(bootstrap, 'POST', '/api/v1/actions/preview', { actionId, project, params }, signal)
}

export function launchPreviewed(bootstrap: ActionsBootstrap, preview: Preview, second: boolean) {
  return actionCall<{ jobId: string }>(bootstrap, 'POST', '/api/v1/actions', {
    actionId: preview.actionId,
    project: preview.project,
    params: preview.params,
    confirm: true,
    commandHash: preview.commandHash,
    secondConfirm: second,
  })
}

export type CheckOutcome = { ok: boolean; text: string }

/** session.check is a fixed bounded preflight: no trial, no second confirmation. Runs it and waits for the answer. */
export async function runCheck(bootstrap: ActionsBootstrap, project: string, session: string, signal?: AbortSignal): Promise<CheckOutcome> {
  const preview = await previewAction(bootstrap, CHECK_ID, project, { session }, signal)
  const { jobId } = await launchPreviewed(bootstrap, preview, false)
  for (;;) {
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
    const job = await actionCall<Job>(bootstrap, 'GET', `/api/v1/jobs/${encodeURIComponent(jobId)}`, undefined, signal)
    if (isTerminal(job.status)) {
      const tail = (job.stderrTail || job.stdoutTail || '').trim().split('\n').slice(-6).join('\n')
      return { ok: job.status === 'succeeded', text: job.status === 'succeeded' ? 'Preflight passed.' : tail || `Preflight ${job.status}.` }
    }
    await new Promise((resolve) => window.setTimeout(resolve, 600))
  }
}
