import { useEffect, useState } from 'react'
import { ApiError, getJson, type ProjectResponse, type ProjectSnapshot } from '../../api'

export type SnapshotLoad =
  | { state: 'loading' }
  | { state: 'ready'; project: ProjectSnapshot }
  | { state: 'error'; message: string }

/**
 * Read-only GET /api/v1/project for each id, the same verified snapshot the Project page uses. The last good snapshot is kept
 * while a refresh is in flight; `refreshKey` changes when the chat records something new (a Run, a trial, a confirmation).
 */
export function useProjectSnapshots(projectIds: string[], refreshKey: string): Record<string, SnapshotLoad> {
  const [loads, setLoads] = useState<Record<string, SnapshotLoad>>({})
  const wanted = [...new Set(projectIds)].sort().join('\n')
  useEffect(() => {
    if (!wanted) return
    const controller = new AbortController()
    for (const id of wanted.split('\n')) {
      getJson<ProjectResponse>(`/api/v1/project?id=${encodeURIComponent(id)}`, controller.signal)
        .then((body) => {
          const project = body.projects[0]
          setLoads((prev) => ({ ...prev, [id]: project ? { state: 'ready', project } : { state: 'error', message: `Unknown Project: ${id}` } }))
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return
          const message = reason instanceof ApiError || reason instanceof Error ? reason.message : String(reason)
          setLoads((prev) => (prev[id]?.state === 'ready' ? prev : { ...prev, [id]: { state: 'error', message } }))
        })
    }
    return () => controller.abort()
  }, [wanted, refreshKey])
  return loads
}
