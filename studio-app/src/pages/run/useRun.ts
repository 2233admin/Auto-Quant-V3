import { useEffect, useState } from 'react'
import { ApiError, getJson } from '../../api'
import type { RunPayload } from './runTypes'

export type RunLoad =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ready'; payload: RunPayload }
  | { state: 'error'; message: string; unsupported?: boolean }

/** Read-only GET /api/v1/run for one Run of one Project. An empty run id means nothing is selected. */
export function useRun(projectId: string, runId: string | undefined): RunLoad {
  const [load, setLoad] = useState<RunLoad>({ state: runId ? 'loading' : 'idle' })
  useEffect(() => {
    if (!runId) {
      setLoad({ state: 'idle' })
      return
    }
    setLoad({ state: 'loading' })
    const controller = new AbortController()
    getJson<RunPayload>(`/api/v1/run?${new URLSearchParams({ project: projectId, id: runId })}`, controller.signal)
      .then((payload) => setLoad({ state: 'ready', payload }))
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        const message = reason instanceof ApiError || reason instanceof Error ? reason.message : String(reason)
        // /api/v1/run answers 422 for a Run that is not a Factor Run.
        setLoad({ state: 'error', message, unsupported: (reason instanceof ApiError && reason.status === 422) || /422|not a factor/i.test(message) })
      })
    return () => controller.abort()
  }, [projectId, runId])
  return load
}
