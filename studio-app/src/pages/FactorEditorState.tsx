import { ActionRow } from '../components/workbench'
import { CopyButton } from '../actions/CopyButton'

export function SessionRecovery({ reason, actions, command, onRestart, busy = false }: { reason: string; actions: boolean; command: string; onRestart: () => void; busy?: boolean }) {
  const visibleReason = reason.replace(/^Blocked: Session \S+ is stale; run aq session show to see why \((.*)\)$/, 'Stale session: $1')
  return <div className="idea-session-recovery" role="note"><p title={reason}>{/stale/i.test(reason) ? <>Stale session — This view was loaded before the workspace changed. </> : null}{visibleReason}</p>{/stale/i.test(reason) && <button className="wb-link" onClick={() => window.location.reload()}>Refresh</button>}{actions
    ? <ActionRow secondary={[busy ? { label: 'Restart session', disabled: true, disabledReason: 'Wait for the current action to finish.' } : { label: 'Restart session', onClick: onRestart }]} />
    : <div className="idea-enable"><code>{command}</code><CopyButton text={command} label="Copy enable command" /></div>}</div>
}
