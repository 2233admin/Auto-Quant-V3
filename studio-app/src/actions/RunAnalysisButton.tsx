import { useId, useState } from 'react'
import type { ProjectSnapshot } from '../api'
import { Modal } from '../shell/Modal'
import { ACTIONS_OFF_COPY, useActions } from './ActionsContext'
import { ConfirmActionDialog } from './ConfirmActionDialog'
import { useCatalog } from './useCatalog'

/**
 * The one primary action of a page: "Run analysis". Disabled, with the reason written beside it,
 * whenever Studio is read-only, the catalog could not load, no Session can take a candidate, or the Project
 * is busy. Nothing starts on click: it opens the confirmation dialog.
 */
export function RunAnalysisButton({ project, preferStudyId }: { project: ProjectSnapshot; preferStudyId?: string }) {
  const { state, activeJobId, setActiveJobId } = useActions()
  const catalog = useCatalog(project.id)
  const [open, setOpen] = useState(false)
  const noteId = useId()

  let reason: string | null = null
  let retry = false
  let available: { session: string; studyId?: string }[] = []
  if (state.mode === 'off') {
    reason = ACTIONS_OFF_COPY
  } else if (state.mode === 'loading' || catalog.state === 'loading') {
    reason = 'Checking what can run…'
  } else if (catalog.state === 'error') {
    reason = `${catalog.title} ${catalog.detail}`
    retry = true
  } else if (catalog.state === 'ready') {
    const { target } = catalog
    const studyOf = new Map(project.sessions.map((s) => [s.session?.id ?? s.id, s.session?.studyId ?? s.studyId]))
    available = target.sessions.filter((s) => s.available).map((s) => ({ session: s.session, studyId: studyOf.get(s.session) }))
    if (target.activeJob) {
      reason = `Blocked: job ${target.activeJob} is already running in this Project.`
    } else if (target.sessions.length === 0) {
      reason = 'Blocked: this Project has no active Session. Start one with aq session start.'
    } else if (available.length === 0) {
      reason = target.sessions[0].blockedBy ?? 'Blocked: no Session can take a candidate right now.'
    }
  }
  available.sort((a, b) => Number(b.studyId === preferStudyId) - Number(a.studyId === preferStudyId))

  const busyJob = catalog.state === 'ready' ? catalog.target.activeJob : null
  return (
    <div className="runbtn">
      <button
        type="button"
        className="abtn abtn--primary"
        disabled={reason !== null}
        aria-describedby={reason ? noteId : undefined}
        onClick={() => setOpen(true)}
      >
        Run analysis
      </button>
      {reason && (
        <p id={noteId} className="small muted runbtn-note">
          {reason}
          {retry && (
            <>
              {' '}
              <button type="button" className="linklike" onClick={catalog.reload}>Retry</button>
            </>
          )}
          {busyJob && activeJobId !== busyJob && (
            <>
              {' '}
              <button type="button" className="linklike" onClick={() => setActiveJobId(busyJob)}>Show its progress</button>
            </>
          )}
        </p>
      )}
      <Modal open={open} onClose={() => setOpen(false)} label="Confirm Run analysis" className="adialog">
        {catalog.state === 'ready' && state.mode === 'on' && (
          <ConfirmActionDialog
            project={project}
            bootstrap={state.bootstrap}
            action={catalog.action}
            sessions={catalog.target.sessions}
            preferred={available[0]?.session}
            onClose={() => setOpen(false)}
            onLaunched={(jobId) => {
              setOpen(false)
              setActiveJobId(jobId)
            }}
          />
        )}
      </Modal>
    </div>
  )
}
