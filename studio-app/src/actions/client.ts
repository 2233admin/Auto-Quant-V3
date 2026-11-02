import { uiTemplate, uiText } from '../i18n'
import type { ActionsBootstrap } from './types'

export type FailureKind = 'token' | 'busy' | 'stale' | 'blocked' | 'validation' | 'unknown-job' | 'timeout' | 'network' | 'server' | 'other'

export type Issue = { path?: string; code?: string; message?: string }

/** Every way an action call can fail, classified so the UI can say what happened and what to do. */
export class ActionHttpError extends Error {
  kind: FailureKind
  status: number
  code: string
  issues: Issue[]
  constructor(kind: FailureKind, status: number, code: string, message: string, issues: Issue[] = []) {
    super(message)
    this.kind = kind
    this.status = status
    this.code = code
    this.issues = issues
  }
}

function classify(status: number, code: string): FailureKind {
  if (status === 403) return 'token'
  if (code === 'studio.busy') return 'busy'
  if (code === 'studio.stale-preview') return 'stale'
  if (code === 'studio.blocked') return 'blocked'
  if (code === 'studio.unknown-job') return 'unknown-job'
  if (status === 422 || code === 'studio.confirm-required' || code === 'studio.second-confirm-required') return 'validation'
  if (status >= 500) return 'server'
  return 'other'
}

export const REQUEST_TIMEOUT_MS = 15_000

/** One call to an action or job route: token header, JSON body, a hard timeout, no silent failure. */
export async function actionCall<T>(
  bootstrap: ActionsBootstrap,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController()
  let timedOut = false
  const timer = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS)
  const onOuterAbort = () => controller.abort()
  signal?.addEventListener('abort', onOuterAbort)
  try {
    const headers: Record<string, string> = { Accept: 'application/json', [bootstrap.tokenHeader]: bootstrap.token }
    if (method === 'POST') headers['Content-Type'] = 'application/json'
    const response = await fetch(path, {
      method,
      headers,
      body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
      signal: controller.signal,
      cache: 'no-store',
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok || payload?.ok === false) {
      const code: string = payload?.error?.code ?? `http.${response.status}`
      const message: string = payload?.error?.message ?? `${response.status} ${response.statusText}`
      throw new ActionHttpError(classify(response.status, code), response.status, code, message, payload?.error?.issues ?? [])
    }
    return payload.data as T
  } catch (reason) {
    if (reason instanceof ActionHttpError) throw reason
    if (signal?.aborted) throw reason
    if (timedOut) throw new ActionHttpError('timeout', 0, 'client.timeout', `Studio did not answer within ${REQUEST_TIMEOUT_MS / 1000} seconds.`)
    throw new ActionHttpError('network', 0, 'client.network', 'Could not reach Studio. The server may have stopped or the network connection dropped.')
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', onOuterAbort)
  }
}

export type ErrorCopy = { title: string; detail: string }

/** A readable title and next step for each failure kind. The server message is kept as the detail. */
export function errorCopy(error: unknown, doing: string): ErrorCopy {
  doing = uiText(doing)
  if (!(error instanceof ActionHttpError)) {
    return { title: uiTemplate("Could not {0}.", [doing]), detail: error instanceof Error ? error.message : String(error) }
  }
  switch (error.kind) {
    case 'token':
      return { title: uiTemplate("Studio refused to {0}: the action token was rejected.", [doing]), detail: uiText("The token changes whenever Studio restarts. Reload this page to get the new one.") }
    case 'busy':
      return { title: uiTemplate("Could not {0}: this Project is busy.", [doing]), detail: uiTemplate("{0}. Only one job runs per Project; wait for it to finish or cancel it.", [error.message]) }
    case 'stale':
      return { title: uiText("The Project changed since the preview."), detail: uiText("The command was not run. Review the refreshed command below and confirm again.") }
    case 'blocked':
      return { title: uiTemplate("Could not {0}: a precondition is not met.", [doing]), detail: error.message }
    case 'validation':
      return { title: uiTemplate("Could not {0}: the request was not accepted.", [doing]), detail: error.issues.map((i) => i.message).filter(Boolean).join('; ') || error.message }
    case 'unknown-job':
      return { title: uiText("Studio no longer knows this job."), detail: uiText("The server was probably restarted. Anything the command already wrote is in the Project and appears in the next snapshot.") }
    case 'timeout':
      return { title: uiTemplate("Could not {0}: Studio timed out.", [doing]), detail: error.message }
    case 'network':
      return { title: uiTemplate("Could not {0}: connection lost.", [doing]), detail: error.message }
    case 'server':
      return { title: uiTemplate("Could not {0}: Studio hit an internal error.", [doing]), detail: error.message }
    default:
      return { title: uiTemplate("Could not {0}.", [doing]), detail: error.message }
  }
}
