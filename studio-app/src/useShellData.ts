import { useCallback, useEffect, useRef, useState } from 'react'
import { getJson, type WorkspaceSummary } from './api'

export const REFRESH_MS = 30_000

export type ShellData = {
  workspace: WorkspaceSummary | null
  error: string | null
  updated: Date | null
  live: boolean
  setLive: (live: boolean) => void
  refresh: () => void
}

/** The workspace summary, refreshed while the page is visible and live. A failed refresh keeps the last data. */
export function useShellData(): ShellData {
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [updated, setUpdated] = useState<Date | null>(null)
  const [live, setLive] = useState(true)
  const controller = useRef<AbortController | null>(null)

  const refresh = useCallback(() => {
    controller.current?.abort()
    const next = new AbortController()
    controller.current = next
    getJson<WorkspaceSummary>('/api/v1/workspace', next.signal)
      .then((data) => {
        setWorkspace(data)
        setError(null)
        setUpdated(new Date())
      })
      .catch((reason: unknown) => {
        if (next.signal.aborted) return
        setError(reason instanceof Error ? reason.message : String(reason))
      })
  }, [])

  useEffect(() => {
    refresh()
    return () => controller.current?.abort()
  }, [refresh])

  useEffect(() => {
    if (!live) return
    const tick = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    const timer = window.setInterval(tick, REFRESH_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [live, refresh])

  return { workspace, error, updated, live, setLive, refresh }
}
