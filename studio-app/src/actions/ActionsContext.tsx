import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { WorkspaceSummary } from '../api'
import { JobPanel } from './JobPanel'
import { readJobHash, writeJobHash } from './jobHash'
import type { ActionsBootstrap } from './types'

export const ACTIONS_OFF_COPY = 'Actions are off. Start Studio with --allow-actions'

export type ActionsState =
  /** The Workspace summary has not arrived, so nothing is known yet. */
  | { mode: 'loading' }
  /** The server did not advertise actions: Studio is read-only. */
  | { mode: 'off' }
  | { mode: 'on'; bootstrap: ActionsBootstrap }

export type ActionsApi = {
  state: ActionsState
  activeJobId: string | null
  /** Open the job panel on this job; null closes it. Persisted in the URL hash. */
  setActiveJobId: (id: string | null) => void
  /** Bumped whenever a job finishes, so catalogs and Project data reload. */
  version: number
  jobFinished: () => void
  go: (href: string) => void
}

const Context = createContext<ActionsApi | null>(null)

export function useActions(): ActionsApi {
  const value = useContext(Context)
  if (!value) throw new Error('useActions needs an ActionsProvider')
  return value
}

/**
 * Reads `actions` from the Workspace bootstrap (absent means disabled: the server never sends it
 * without --allow-actions), owns the active job id and renders the job panel once for the whole app.
 */
export function ActionsProvider({
  workspace,
  routeKey,
  go,
  refresh,
  children,
}: {
  workspace: WorkspaceSummary | null
  routeKey: string
  go: (href: string) => void
  refresh: () => void
  children: ReactNode
}) {
  const [activeJobId, setActive] = useState<string | null>(() => readJobHash())
  const [version, setVersion] = useState(0)

  const state = useMemo<ActionsState>(() => {
    if (!workspace) return { mode: 'loading' }
    const bootstrap = workspace.actions
    return bootstrap?.enabled && bootstrap.token ? { mode: 'on', bootstrap } : { mode: 'off' }
  }, [workspace])

  const setActiveJobId = useCallback((id: string | null) => {
    setActive(id)
    writeJobHash(id)
  }, [])

  // In-app navigation drops the hash; put the job id back so a reload still resumes the panel.
  useEffect(() => {
    if (readJobHash() !== activeJobId) writeJobHash(activeJobId)
  }, [routeKey, activeJobId])

  useEffect(() => {
    const onHash = () => setActive(readJobHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const jobFinished = useCallback(() => {
    setVersion((v) => v + 1)
    refresh()
  }, [refresh])

  const api = useMemo<ActionsApi>(
    () => ({ state, activeJobId, setActiveJobId, version, jobFinished, go }),
    [state, activeJobId, setActiveJobId, version, jobFinished, go],
  )

  return (
    <Context.Provider value={api}>
      {children}
      {state.mode === 'on' && activeJobId && <JobPanel key={activeJobId} jobId={activeJobId} bootstrap={state.bootstrap} />}
    </Context.Provider>
  )
}
