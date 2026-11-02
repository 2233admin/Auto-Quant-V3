import { uiText } from '../i18n'
import { useEffect, useState } from 'react'
import { useActions } from './ActionsContext'
import { actionCall } from './client'
import type { Job } from './types'

/**
 * "launched from Studio (job X)" beside a Run, joined from this server's job list by the Run id the job's own
 * output named. Operational metadata only: it sits beside the Run and never inside a verdict. Absent when the
 * Run was not launched by this Studio process (an Agent run simply has no job).
 */
export function LaunchedLabel({ runId }: { runId: string }) {
  const { state, version } = useActions()
  const [job, setJob] = useState<string | null>(null)
  const bootstrap = state.mode === 'on' ? state.bootstrap : null
  useEffect(() => {
    setJob(null)
    if (!bootstrap) return
    const controller = new AbortController()
    actionCall<{ jobs: Job[] }>(bootstrap, 'GET', '/api/v1/jobs', undefined, controller.signal)
      .then((data) => setJob(data.jobs.find((j) => j.createdRefs?.runId === runId)?.jobId ?? null))
      .catch(() => undefined)
    return () => controller.abort()
  }, [bootstrap, runId, version])
  if (!job) return null
  return (
    <span className="alabel" title={uiText("Operational metadata from this Studio process; not part of the verdict.")}>{uiText("launched from Studio (job ")}{job})
    </span>
  )
}
