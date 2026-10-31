import { useEffect, useState } from 'react'
import { ApiError, getJson } from '../../api'
import type { RunPayload } from './runTypes'

export type RunLoad =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ready'; payload: RunPayload }
  | { state: 'error'; message: string }

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
        setLoad({ state: 'error', message: reason instanceof ApiError || reason instanceof Error ? reason.message : String(reason) })
      })
    return () => controller.abort()
  }, [projectId, runId])
  return load
}
