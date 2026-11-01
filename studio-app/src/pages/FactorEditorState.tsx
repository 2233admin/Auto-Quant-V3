import { ActionRow } from '../components/workbench'
import { CopyButton } from '../actions/CopyButton'

export function SessionRecovery({ reason, actions, command, onRestart, busy = false }: { reason: string; actions: boolean; command: string; onRestart: () => void; busy?: boolean }) {
  const visibleReason = reason.replace(/^Blocked: Session \S+ is stale; run aq session show to see why \((.*)\)$/, 'Stale Session: $1')
  return <div className="idea-session-recovery" role="note"><p title={reason}>{visibleReason}</p>{actions
    ? <ActionRow primary={busy ? { label: 'Restart session', disabled: true, disabledReason: 'Wait for the current action to finish.' } : { label: 'Restart session', onClick: onRestart }} />
    : <div className="idea-enable"><code>{command}</code><CopyButton text={command} label="Copy enable command" /></div>}</div>
}
