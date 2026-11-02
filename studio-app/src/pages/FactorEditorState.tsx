import { uiText, uiValue } from '../i18n'
import { STATE_COPY } from '../components/stateCopy'
import { ActionRow } from '../components/workbench'
import { CopyButton } from '../actions/CopyButton'

export function SessionRecovery({ reason, actions, command, onRestart, busy = false }: { reason: string; actions: boolean; command: string; onRestart: () => void; busy?: boolean }) {
  const visibleReason = reason.replace(/^Blocked: Session \S+ is stale; run aq session show to see why \((.*)\)$/, 'Stale session: $1')
  const stale = /stale/i.test(reason)
  return <div className="idea-session-recovery" role="note"><p title={reason}>{stale ? `${STATE_COPY.stale} — ${STATE_COPY.staleReason} ` : null}{uiValue(visibleReason)}</p>{stale && <button className="wb-link" onClick={() => window.location.reload()}>{STATE_COPY.refresh}</button>}{actions
    ? <ActionRow secondary={[busy ? { label: uiText("Restart session"), disabled: true, disabledReason: uiText("Wait for the current action to finish.") } : { label: uiText("Restart session"), onClick: onRestart }]} />
    : <div className="idea-enable"><code>{command}</code><CopyButton text={command} label={uiText("Copy enable command")} /></div>}</div>
}
