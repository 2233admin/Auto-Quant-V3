import { useEffect, useState } from 'react'
import { useActions } from './ActionsContext'
import { actionCall, errorCopy } from './client'
import type { Catalog, CatalogAction, CatalogTarget } from './types'

export const EVALUATE_ID = 'experiment.evaluate'

export type CatalogLoad =
  | { state: 'off' }
  | { state: 'loading' }
  | { state: 'error'; title: string; detail: string }
  | { state: 'ready'; action: CatalogAction; target: CatalogTarget; start: CatalogTarget | null }

/** GET /api/v1/actions?project=<id>, reloaded whenever a job finishes. Preconditions come from the server, never from the browser. */
export function useCatalog(projectId: string): CatalogLoad & { reload: () => void } {
  const { state, version } = useActions()
  const [load, setLoad] = useState<CatalogLoad>({ state: 'loading' })
  const [nonce, setNonce] = useState(0)
  const bootstrap = state.mode === 'on' ? state.bootstrap : null
  const mode = state.mode

  useEffect(() => {
    if (mode === 'off') {
      setLoad({ state: 'off' })
      return
    }
    if (!bootstrap) {
      setLoad({ state: 'loading' })
      return
    }
    const controller = new AbortController()
    setLoad((prev) => (prev.state === 'ready' ? prev : { state: 'loading' }))
    actionCall<Catalog>(bootstrap, 'GET', `/api/v1/actions?project=${encodeURIComponent(projectId)}`, undefined, controller.signal)
      .then((catalog) => {
        const action = catalog.actions.find((a) => a.id === EVALUATE_ID)
        const target = action?.targets.find((t) => t.project === projectId)
        const start = catalog.actions.find((a) => a.id === 'session.start')?.targets.find((t) => t.project === projectId) ?? null
        setLoad(action && target ? { state: 'ready', action, target, start } : { state: 'error', title: 'This Project is not in the action catalog.', detail: 'Studio did not list Run analysis for it.' })
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        const copy = errorCopy(reason, 'load the available actions')
        setLoad({ state: 'error', ...copy })
      })
    return () => controller.abort()
  }, [mode, bootstrap, projectId, version, nonce])

  return { ...load, reload: () => setNonce((n) => n + 1) }
}
